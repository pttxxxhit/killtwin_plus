import JSZip from 'jszip';

export interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  hash?: string;
  path?: string;
  previewUrl?: string;
}

export interface DuplicateGroup {
  original: FileItem;
  duplicates: FileItem[];
  hash: string;
}

// Compute SHA-256 hash for duplicate detection safely
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ScanErrorLog {
  fileName: string;
  filePath?: string;
  reason: string;
}

// Identify duplicates from a list of files with error handling & size optimization
export async function findDuplicates(
  files: FileItem[],
  onProgress?: (scannedCount: number, totalCount: number) => void
): Promise<{
  duplicatesList: { duplicate: FileItem; original: FileItem }[];
  duplicateGroups: DuplicateGroup[];
  errorLogs: ScanErrorLog[];
}> {
  const duplicatesList: { duplicate: FileItem; original: FileItem }[] = [];
  const groupMap = new Map<string, { original: FileItem; duplicates: FileItem[] }>();
  const errorLogs: ScanErrorLog[] = [];

  // Group files by size first to optimize
  const sizeMap = new Map<number, FileItem[]>();
  for (const item of files) {
    const existing = sizeMap.get(item.size) || [];
    existing.push(item);
    sizeMap.set(item.size, existing);
  }

  const hashMap = new Map<string, FileItem>();
  let scannedCount = 0;
  const totalCount = files.length;

  for (const [size, sameSizeFiles] of sizeMap.entries()) {
    // If only 1 file has this exact size, it cannot be a duplicate
    if (sameSizeFiles.length === 1) {
      scannedCount += 1;
      if (onProgress) onProgress(scannedCount, totalCount);
      continue;
    }

    // Multiple files have the same size, calculate hash for comparison
    for (const item of sameSizeFiles) {
      try {
        const hash = item.hash || (await computeFileHash(item.file));
        item.hash = hash;

        if (hashMap.has(hash)) {
          const original = hashMap.get(hash)!;
          duplicatesList.push({ duplicate: item, original });

          if (!groupMap.has(hash)) {
            groupMap.set(hash, { original, duplicates: [item] });
          } else {
            groupMap.get(hash)!.duplicates.push(item);
          }
        } else {
          hashMap.set(hash, item);
        }
      } catch (err: any) {
        errorLogs.push({
          fileName: item.name,
          filePath: item.path || item.name,
          reason: err?.message || 'Error al acceder/leer el archivo local',
        });
      }

      scannedCount += 1;
      if (onProgress) onProgress(scannedCount, totalCount);
    }
  }

  const duplicateGroups: DuplicateGroup[] = Array.from(groupMap.entries()).map(
    ([hash, val]) => ({
      hash,
      original: val.original,
      duplicates: val.duplicates,
    })
  );

  return { duplicatesList, duplicateGroups, errorLogs };
}

// Categorize files by extension
export const FILE_CATEGORIES: Record<string, string[]> = {
  Imagenes: ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg', '.bmp'],
  Videos: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv'],
  Documentos: ['.pdf', '.docx', '.doc', '.txt', '.pptx', '.ppt', '.xlsx', '.xls'],
  Datasets: ['.xlsx', '.csv', '.sav', '.json', '.xml', '.parquet'],
  Comprimidos: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
};

export function getFileCategory(filename: string): string {
  const lower = filename.toLowerCase();
  for (const [category, exts] of Object.entries(FILE_CATEGORIES)) {
    if (exts.some((ext) => lower.endsWith(ext))) {
      return category;
    }
  }
  return 'Otros';
}

export function organizeFiles(files: FileItem[]): Record<string, FileItem[]> {
  const result: Record<string, FileItem[]> = {
    Imagenes: [],
    Videos: [],
    Documentos: [],
    Datasets: [],
    Comprimidos: [],
    Otros: [],
  };

  for (const item of files) {
    const cat = getFileCategory(item.name);
    if (!result[cat]) result[cat] = [];
    result[cat].push(item);
  }

  return result;
}

// Resize image using HTML Canvas
export function resizeImage(
  file: File,
  targetWidth: number,
  targetHeight: number
): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo crear el contexto 2D del canvas'));
        return;
      }

      // Draw resized
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Determine output mime type
      const mimeType = file.type || 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('Error al generar la imagen redimensionada'));
            return;
          }
          const resizedUrl = URL.createObjectURL(blob);
          resolve({ blob, url: resizedUrl });
        },
        mimeType,
        0.92
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen para redimensionar'));
    };

    img.src = url;
  });
}

// Generate sequential batch names
export function generateSequentialNames(
  files: FileItem[],
  baseName: string
): { item: FileItem; newName: string }[] {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  const usedNames = new Set<string>();

  return sorted.map((item, index) => {
    const seq = index + 1;
    const dotIndex = item.name.lastIndexOf('.');
    const ext = dotIndex !== -1 ? item.name.substring(dotIndex) : '';

    let candidate = `${baseName} ${seq}${ext}`;
    let counter = 1;

    while (usedNames.has(candidate)) {
      candidate = `${baseName} ${seq} (${counter})${ext}`;
      counter++;
    }

    usedNames.add(candidate);
    return { item, newName: candidate };
  });
}

// Create ZIP file for organized folders or batch downloads
export async function createZipArchive(
  folderStructure: Record<string, { name: string; data: Blob | File }[]>
): Promise<Blob> {
  const zip = new JSZip();

  for (const [folderName, files] of Object.entries(folderStructure)) {
    const folder = folderName ? zip.folder(folderName) : zip;
    if (folder) {
      for (const f of files) {
        folder.file(f.name, f.data);
      }
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

// Format bytes into human readable size
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
