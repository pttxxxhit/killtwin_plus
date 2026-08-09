import React, { useState, useRef, useId } from 'react';
import {
  Search,
  FolderOpen,
  Crop,
  Edit3,
  Trash2,
  Trash,
  FolderArchive,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Film,
  Database,
  Archive,
  File as FileIcon,
  RefreshCw,
  X,
  Check,
  ShieldCheck,
  HardDrive,
  Info,
  ExternalLink,
  Globe
} from 'lucide-react';
import {
  FileItem,
  ScanErrorLog,
  findDuplicates,
  organizeFiles,
  resizeImage,
  generateSequentialNames,
  createZipArchive,
  formatBytes
} from './utils/fileUtils';

type ActiveTab = 'duplicates' | 'organize' | 'resize' | 'rename';

// Helper to extract files from Drag & Drop entries (including directories)
async function extractFilesFromDataTransfer(items: DataTransferItemList): Promise<File[]> {
  const fileList: File[] = [];

  const readEntry = async (entry: any) => {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (f: File) => {
            fileList.push(f);
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readEntries = (): Promise<any[]> =>
        new Promise((resolve) => {
          dirReader.readEntries(
            (entries: any[]) => resolve(entries),
            () => resolve([])
          );
        });
      let entries = await readEntries();
      while (entries.length > 0) {
        for (const child of entries) {
          await readEntry(child);
        }
        entries = await readEntries();
      }
    }
  };

  const entryPromises = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        entryPromises.push(readEntry(entry));
      } else {
        const f = item.getAsFile();
        if (f) fileList.push(f);
      }
    }
  }

  await Promise.all(entryPromises);
  return fileList;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('duplicates');
  const [snackMessage, setSnackMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Accessible unique IDs for file inputs
  const dupFolderInputId = useId();
  const dupFileInputId = useId();
  const orgFolderInputId = useId();
  const orgFileInputId = useId();
  const resFolderInputId = useId();
  const resFileInputId = useId();
  const renFolderInputId = useId();
  const renFileInputId = useId();

  // Helper for notifications
  const notify = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setSnackMessage({ text, type });
    setTimeout(() => {
      setSnackMessage(null);
    }, 5000);
  };

  // --- TAB 1: DUPLICADOS STATE & REFS ---
  const [dupFiles, setDupFiles] = useState<FileItem[]>([]);
  const [dupDirName, setDupDirName] = useState<string>('');
  const [duplicateList, setDuplicateList] = useState<{ duplicate: FileItem; original: FileItem }[]>([]);
  const [dupScanned, setDupScanned] = useState(false);
  const [dupScanning, setDupScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [scanErrorLogs, setScanErrorLogs] = useState<ScanErrorLog[]>([]);

  const loadRawFilesForDuplicates = (rawFiles: File[]) => {
    if (!rawFiles || rawFiles.length === 0) return;
    const folderName = rawFiles[0]?.webkitRelativePath?.split('/')[0] || '';
    const items: FileItem[] = rawFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      path: (file as any).webkitRelativePath || file.name,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setDupFiles(items);
    setDupDirName(folderName);
    setDupScanned(false);
    setDuplicateList([]);
    setScanErrorLogs([]);
    notify(`Carpeta cargada (${items.length} archivos). Haz clic en "Escanear duplicados".`, 'success');
  };

  const handleDupFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    loadRawFilesForDuplicates(Array.from(e.target.files));
  };

  const handleDupDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer.items);
      if (files.length > 0) loadRawFilesForDuplicates(files);
    } else if (e.dataTransfer.files) {
      loadRawFilesForDuplicates(Array.from(e.dataTransfer.files));
    }
  };

  const runDuplicateScan = async () => {
    if (dupFiles.length === 0) {
      notify('Por favor, selecciona una carpeta o archivos primero.', 'error');
      return;
    }
    setDupScanning(true);
    setScanProgress({ current: 0, total: dupFiles.length });
    setScanErrorLogs([]);

    try {
      const { duplicatesList, errorLogs } = await findDuplicates(dupFiles, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
      });

      setDuplicateList(duplicatesList);
      setScanErrorLogs(errorLogs);
      setDupScanned(true);

      if (duplicatesList.length === 0 && errorLogs.length === 0) {
        notify('Escaneo completo: no se encontraron archivos duplicados.', 'success');
      } else if (errorLogs.length > 0) {
        notify(
          `Escaneo finalizado: ${duplicatesList.length} duplicados. (${errorLogs.length} archivo(s) omitidos por bloqueos del sistema)`,
          'info'
        );
      } else {
        notify(`Escaneo completo: se encontraron ${duplicatesList.length} duplicados.`, 'info');
      }
    } catch (err: any) {
      notify(`Error al escanear: ${err.message}`, 'error');
    } finally {
      setDupScanning(false);
      setScanProgress(null);
    }
  };

  const deleteSingleDuplicate = (dupId: string) => {
    setDuplicateList((prev) => prev.filter((item) => item.duplicate.id !== dupId));
    setDupFiles((prev) => prev.filter((item) => item.id !== dupId));
    notify('Archivo duplicado removido.', 'success');
  };

  const deleteAllDuplicates = () => {
    const dupIds = new Set(duplicateList.map((item) => item.duplicate.id));
    setDupFiles((prev) => prev.filter((item) => !dupIds.has(item.id)));
    const count = duplicateList.length;
    setDuplicateList([]);
    notify(`Se removieron ${count} duplicados.`, 'success');
  };

  const downloadCleanedFiles = async () => {
    if (dupFiles.length === 0) return;
    const zipFiles = dupFiles.map((f) => ({ name: f.name, data: f.file }));
    const zipBlob = await createZipArchive({ '': zipFiles });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dupDirName || 'archivos'}_sin_duplicados.zip`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Colección limpia descargada en ZIP.', 'success');
  };

  // --- TAB 2: ORGANIZAR STATE & REFS ---
  const [orgFiles, setOrgFiles] = useState<FileItem[]>([]);
  const [orgDirName, setOrgDirName] = useState<string>('');
  const [organizedResult, setOrganizedResult] = useState<Record<string, FileItem[]> | null>(null);

  const loadRawFilesForOrganize = (rawFiles: File[]) => {
    if (!rawFiles || rawFiles.length === 0) return;
    const folderName = rawFiles[0]?.webkitRelativePath?.split('/')[0] || '';
    const items: FileItem[] = rawFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      path: (file as any).webkitRelativePath || file.name,
    }));
    setOrgFiles(items);
    setOrgDirName(folderName);
    setOrganizedResult(null);
    notify(`Carpeta cargada (${items.length} archivos). Haz clic en "Organizar".`, 'success');
  };

  const handleOrgFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    loadRawFilesForOrganize(Array.from(e.target.files));
  };

  const handleOrgDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer.items);
      if (files.length > 0) loadRawFilesForOrganize(files);
    } else if (e.dataTransfer.files) {
      loadRawFilesForOrganize(Array.from(e.dataTransfer.files));
    }
  };

  const runOrganize = () => {
    if (orgFiles.length === 0) {
      notify('Selecciona una carpeta o archivos primero.', 'error');
      return;
    }
    const grouped = organizeFiles(orgFiles);
    setOrganizedResult(grouped);
    notify('Organización completada. Ya puedes descargar el paquete en subcarpetas.', 'success');
  };

  const downloadOrganizedZip = async () => {
    if (!organizedResult) return;
    const folderStructure: Record<string, { name: string; data: File }[]> = {};

    for (const [category, files] of Object.entries(organizedResult)) {
      if (files.length > 0) {
        folderStructure[category] = files.map((f) => ({ name: f.name, data: f.file }));
      }
    }

    const zipBlob = await createZipArchive(folderStructure);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orgDirName || 'archivos'}_organizados.zip`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Estructura de carpetas descargada en archivo ZIP.', 'success');
  };

  // --- TAB 3: REDIMENSIONAR STATE & REFS ---
  const [resFiles, setResFiles] = useState<FileItem[]>([]);
  const [resDirName, setResDirName] = useState<string>('');
  const [widthVal, setWidthVal] = useState<number>(800);
  const [heightVal, setHeightVal] = useState<number>(600);
  const [resizedResults, setResizedResults] = useState<{
    original: FileItem;
    resizedBlob: Blob;
    resizedUrl: string;
    width: number;
    height: number;
    newName: string;
  }[]>([]);
  const [resizing, setResizing] = useState<boolean>(false);

  const loadRawFilesForResize = (rawFiles: File[]) => {
    if (!rawFiles || rawFiles.length === 0) return;
    const folderName = rawFiles[0]?.webkitRelativePath?.split('/')[0] || '';
    const imagesOnly = rawFiles.filter((f) => f.type.startsWith('image/'));
    if (imagesOnly.length === 0) {
      notify('Por favor, selecciona una carpeta que contenga imágenes (JPG, PNG, WEBP, GIF).', 'error');
      return;
    }
    const items: FileItem[] = imagesOnly.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file),
    }));
    setResFiles(items);
    setResDirName(folderName);
    setResizedResults([]);
    notify(`Se seleccionaron ${items.length} imágenes para redimensionar.`, 'success');
  };

  const handleResFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    loadRawFilesForResize(Array.from(e.target.files));
  };

  const handleResDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer.items);
      if (files.length > 0) loadRawFilesForResize(files);
    } else if (e.dataTransfer.files) {
      loadRawFilesForResize(Array.from(e.dataTransfer.files));
    }
  };

  const runResize = async () => {
    if (resFiles.length === 0) {
      notify('Selecciona una carpeta de imágenes primero.', 'error');
      return;
    }
    if (widthVal <= 0 || heightVal <= 0) {
      notify('El ancho y alto deben ser valores positivos.', 'error');
      return;
    }

    setResizing(true);
    try {
      const results = [];
      for (const item of resFiles) {
        const { blob, url } = await resizeImage(item.file, widthVal, heightVal);
        results.push({
          original: item,
          resizedBlob: blob,
          resizedUrl: url,
          width: widthVal,
          height: heightVal,
          newName: `resized_${item.name}`,
        });
      }
      setResizedResults(results);
      notify(`${results.length} imágenes redimensionadas exitosamente.`, 'success');
    } catch (err: any) {
      notify(`Error al redimensionar: ${err.message}`, 'error');
    } finally {
      setResizing(false);
    }
  };

  const downloadResizedZip = async () => {
    if (resizedResults.length === 0) return;
    const files = resizedResults.map((r) => ({
      name: r.newName,
      data: r.resizedBlob,
    }));
    const zipBlob = await createZipArchive({ '': files });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resDirName || 'imagenes'}_redimensionadas.zip`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Imágenes redimensionadas descargadas en ZIP.', 'success');
  };

  // --- TAB 4: RENOMBRAR STATE & REFS ---
  const [renFiles, setRenFiles] = useState<FileItem[]>([]);
  const [renDirName, setRenDirName] = useState<string>('');
  const [baseName, setBaseName] = useState<string>('');
  const [renamedPreview, setRenamedPreview] = useState<{ item: FileItem; newName: string }[]>([]);

  const loadRawFilesForRename = (rawFiles: File[]) => {
    if (!rawFiles || rawFiles.length === 0) return;
    const folderName = rawFiles[0]?.webkitRelativePath?.split('/')[0] || '';
    const items: FileItem[] = rawFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    setRenFiles(items);
    setRenDirName(folderName);
    if (baseName.trim()) {
      setRenamedPreview(generateSequentialNames(items, baseName.trim()));
    }
    notify(`Seleccionados ${items.length} archivos para renombrar.`, 'success');
  };

  const handleRenFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    loadRawFilesForRename(Array.from(e.target.files));
  };

  const handleRenDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer.items);
      if (files.length > 0) loadRawFilesForRename(files);
    } else if (e.dataTransfer.files) {
      loadRawFilesForRename(Array.from(e.dataTransfer.files));
    }
  };

  const handleBaseNameChange = (val: string) => {
    setBaseName(val);
    if (renFiles.length > 0 && val.trim()) {
      setRenamedPreview(generateSequentialNames(renFiles, val.trim()));
    } else {
      setRenamedPreview([]);
    }
  };

  const downloadRenamedZip = async () => {
    if (renamedPreview.length === 0) {
      notify('Ingresa un nombre base y selecciona archivos/carpeta.', 'error');
      return;
    }
    const files = renamedPreview.map((p) => ({
      name: p.newName,
      data: p.item.file,
    }));
    const zipBlob = await createZipArchive({ '': files });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archivos_${baseName || 'renombrados'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Se renombraron y descargaron ${files.length} archivos exitosamente.`, 'success');
  };

  return (
    <div className="flex h-screen w-full bg-black text-blue-100 overflow-hidden font-sans relative">
      {/* Semi-transparent background logo watermark */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.06] bg-center bg-no-repeat bg-contain z-0 pointer-events-none"
        style={{ backgroundImage: `url('/pttech_full_logo.png')` }}
      />

      {/* Toast / Snackbar Notification */}
      {snackMessage && (
        <div
          id="toast-notification"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 ${
            snackMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : snackMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-blue-950/90 border-blue-500/50 text-blue-200'
          }`}
        >
          {snackMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {snackMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {snackMessage.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />}
          <span className="text-sm font-medium">{snackMessage.text}</span>
          <button
            onClick={() => setSnackMessage(null)}
            className="text-gray-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* LEFT NAVIGATION RAIL */}
      <aside
        id="navigation-rail"
        className="w-24 md:w-56 bg-slate-900/90 border-r border-slate-800 flex flex-col items-center md:items-stretch py-6 px-2 md:px-3 select-none backdrop-blur-md z-10"
      >
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#f5f2e6] border border-amber-300/50 p-0.5 flex items-center justify-center shrink-0 shadow-lg shadow-blue-950/50 overflow-hidden">
            <img
              src="/pttech_full_logo.png"
              alt="PTTECH Corp Logo"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div className="hidden md:block min-w-0">
            <h1 className="font-bold text-sm tracking-wide text-white truncate">KillTwin</h1>
            <p className="text-[10px] text-blue-300/70 font-semibold tracking-wider uppercase truncate">PTTECH Corp</p>
          </div>
        </div>

        {/* Security badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 mb-6 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Procesamiento 100% Local</span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <button
            id="tab-btn-duplicates"
            onClick={() => setActiveTab('duplicates')}
            className={`flex flex-col md:flex-row items-center gap-2 md:gap-3 px-3 py-3 rounded-xl text-xs md:text-sm font-medium transition-all ${
              activeTab === 'duplicates'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-lg shadow-blue-950/50'
                : 'text-blue-200/70 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Search className={`w-5 h-5 ${activeTab === 'duplicates' ? 'text-blue-400' : ''}`} />
            <span className="text-center md:text-left">Duplicados</span>
          </button>

          <button
            id="tab-btn-organize"
            onClick={() => setActiveTab('organize')}
            className={`flex flex-col md:flex-row items-center gap-2 md:gap-3 px-3 py-3 rounded-xl text-xs md:text-sm font-medium transition-all ${
              activeTab === 'organize'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-lg shadow-blue-950/50'
                : 'text-blue-200/70 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <FolderOpen className={`w-5 h-5 ${activeTab === 'organize' ? 'text-blue-400' : ''}`} />
            <span className="text-center md:text-left">Organizar</span>
          </button>

          <button
            id="tab-btn-resize"
            onClick={() => setActiveTab('resize')}
            className={`flex flex-col md:flex-row items-center gap-2 md:gap-3 px-3 py-3 rounded-xl text-xs md:text-sm font-medium transition-all ${
              activeTab === 'resize'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-lg shadow-blue-950/50'
                : 'text-blue-200/70 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Crop className={`w-5 h-5 ${activeTab === 'resize' ? 'text-blue-400' : ''}`} />
            <span className="text-center md:text-left">Redimensionar</span>
          </button>

          <button
            id="tab-btn-rename"
            onClick={() => setActiveTab('rename')}
            className={`flex flex-col md:flex-row items-center gap-2 md:gap-3 px-3 py-3 rounded-xl text-xs md:text-sm font-medium transition-all ${
              activeTab === 'rename'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-lg shadow-blue-950/50'
                : 'text-blue-200/70 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Edit3 className={`w-5 h-5 ${activeTab === 'rename' ? 'text-blue-400' : ''}`} />
            <span className="text-center md:text-left">Renombrar</span>
          </button>
        </nav>

        <div className="pt-4 border-t border-slate-800 flex flex-col items-center md:items-start gap-1 px-2 text-center md:text-left">
          <span className="text-[11px] text-blue-300/40 font-mono">v1.0.0 Web</span>
          <a
            href="https://www.pttech.cl"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors underline group mt-0.5"
            title="Visitar PTTECH Corp"
          >
            <Globe className="w-3 h-3 text-blue-400 shrink-0 group-hover:rotate-12 transition-transform" />
            <span className="hidden md:inline">www.Pttech.cl</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-80" />
          </a>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-br from-slate-950 via-black to-slate-950 z-10">
        <div className="max-w-5xl mx-auto h-full flex flex-col">

          {/* VISTA 1: DUPLICADOS */}
          {activeTab === 'duplicates' && (
            <div id="view-duplicates" className="flex flex-col gap-6 h-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-blue-200 mb-1">Eliminar Archivos Duplicados</h2>
                  <p className="text-sm text-blue-300/60">
                    Selecciona una carpeta local para escanear archivos repetidos con algoritmo SHA-256.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400/90 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1.5 rounded-lg w-fit">
                  <HardDrive className="w-4 h-4" />
                  <span>Sin carga a servidor • 100% Privado</span>
                </div>
              </div>

              {/* Security info note */}
              <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-3 flex items-center gap-3 text-xs text-blue-200/80">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Nota sobre el mensaje del navegador:</strong> Cuando el navegador pregunta si quieres "subir" la carpeta, se refiere a otorgar permiso a la aplicación web para leer los archivos en la memoria local de tu navegador. <strong>Ningún archivo sale de tu dispositivo.</strong>
                </span>
              </div>

              {/* Upload & Controls Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDupDrop}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm transition-colors hover:border-slate-700"
              >
                {/* Synchronous Direct HTML Inputs */}
                <input
                  id={dupFileInputId}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleDupFilesSelected}
                />
                <input
                  id={dupFolderInputId}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  className="hidden"
                  onChange={handleDupFilesSelected}
                />

                <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor={dupFolderInputId}
                      className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-950/40"
                    >
                      <FolderOpen className="w-4 h-4 text-blue-100" />
                      <span>Seleccionar Carpeta</span>
                    </label>

                    <label
                      htmlFor={dupFileInputId}
                      className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-blue-200 border border-slate-700 font-medium text-sm transition-all shadow-md"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Seleccionar Archivos</span>
                    </label>

                    <span className="text-xs text-blue-300/70 ml-1">
                      {dupFiles.length > 0
                        ? `Carpeta: "${dupDirName || 'Seleccionada'}" (${dupFiles.length} archivos)`
                        : 'O arrastra una carpeta aquí'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      id="scan-duplicates-btn"
                      onClick={runDuplicateScan}
                      disabled={dupFiles.length === 0 || dupScanning}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all font-medium text-sm shadow-lg shadow-blue-900/30"
                    >
                      <Search className="w-4 h-4" />
                      <span>{dupScanning ? 'Escaneando...' : 'Escanear duplicados'}</span>
                    </button>

                    {duplicateList.length > 0 && (
                      <button
                        id="delete-all-duplicates-btn"
                        onClick={deleteAllDuplicates}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-900 hover:bg-rose-800 text-white font-medium text-sm transition-all shadow-lg shadow-rose-950/50"
                      >
                        <Trash className="w-4 h-4" />
                        <span>Remover todos ({duplicateList.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {dupScanning && scanProgress && (
                  <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-blue-300">
                      <span>Escaneando archivos y analizando huellas SHA-256...</span>
                      <span className="font-mono">
                        {Math.round((scanProgress.current / scanProgress.total) * 100)}% ({scanProgress.current} / {scanProgress.total})
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className="bg-blue-500 h-full transition-all duration-150 rounded-full"
                        style={{
                          width: `${Math.round((scanProgress.current / scanProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {dupScanned && (
                  <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium ${
                          duplicateList.length > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {duplicateList.length > 0
                          ? `Se encontraron ${duplicateList.length} archivos duplicados.`
                          : 'No se encontraron archivos duplicados.'}
                      </span>

                      {dupFiles.length > 0 && duplicateList.length === 0 && (
                        <button
                          onClick={downloadCleanedFiles}
                          className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 font-medium underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Descargar colección limpia (.zip)
                        </button>
                      )}
                    </div>

                    {/* Scan error / permission log panel */}
                    {scanErrorLogs.length > 0 && (
                      <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-200/90 flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Reporte de Diagnóstico ({scanErrorLogs.length} archivos omitidos)</span>
                        </div>
                        <p className="text-amber-200/70 text-[11px]">
                          <strong>¿Qué significa?</strong> Estos archivos están siendo usados por otra aplicación en tu equipo, o el sistema operativo no otorgó permiso directo de lectura en memoria. <strong>KillTwin los omitió de forma segura y continuó completando el escaneo del resto de tu carpeta.</strong>
                        </p>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-amber-400 hover:underline font-medium text-[11px]">
                            Ver lista de archivos no accesibles ({scanErrorLogs.length})
                          </summary>
                          <div className="mt-2 max-h-36 overflow-y-auto flex flex-col gap-1.5 p-2 bg-black/40 rounded-lg border border-amber-900/40 font-mono text-[11px]">
                            {scanErrorLogs.map((log, index) => (
                              <div key={index} className="flex justify-between items-center text-slate-300">
                                <span className="truncate pr-2">{log.filePath || log.fileName}</span>
                                <span className="text-amber-400/80 shrink-0">{log.reason}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Duplicate Results List */}
              <div className="flex-1 bg-slate-900/20 border border-slate-800/60 rounded-2xl p-4 overflow-y-auto min-h-[300px]">
                {duplicateList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-blue-300/40">
                    <Search className="w-12 h-12 mb-3 stroke-[1.5]" />
                    <p className="text-sm">
                      {dupFiles.length === 0
                        ? 'Haz clic en "Seleccionar Carpeta" para elegir la carpeta a escanear.'
                        : dupScanned
                        ? '¡Excelente! No hay duplicados en esta carpeta.'
                        : 'Haz clic en "Escanear duplicados" para procesar la carpeta seleccionada.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {duplicateList.map(({ duplicate, original }) => (
                      <div
                        key={duplicate.id}
                        className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-800/40 text-blue-300 shrink-0 mt-0.5">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/40">
                                Duplicado
                              </span>
                              <span className="text-sm font-medium text-white truncate">
                                {duplicate.name}
                              </span>
                            </div>
                            <p className="text-xs text-blue-300/60 truncate">
                              Original: <span className="text-blue-200">{original.name}</span> ({formatBytes(duplicate.size)})
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteSingleDuplicate(duplicate.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/50 text-rose-200 text-xs font-medium transition-all shrink-0"
                          title="Eliminar este duplicado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: ORGANIZAR */}
          {activeTab === 'organize' && (
            <div id="view-organize" className="flex flex-col gap-6 h-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-blue-200 mb-1">Organizar Archivos por Tipo</h2>
                  <p className="text-sm text-blue-300/60">
                    Clasifica una carpeta completa en subcarpetas (imágenes, videos, documentos, datasets, comprimidos).
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400/90 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1.5 rounded-lg w-fit">
                  <HardDrive className="w-4 h-4" />
                  <span>Sin carga a servidor • 100% Privado</span>
                </div>
              </div>

              {/* Security info note */}
              <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-3 flex items-center gap-3 text-xs text-blue-200/80">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Nota sobre el mensaje del navegador:</strong> Cuando el navegador solicita permiso de lectura para la carpeta, procesa todo dentro de la memoria de tu navegador y te permite descargar el ZIP estructurado. <strong>Procesamiento local sin subir nada.</strong>
                </span>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleOrgDrop}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors hover:border-slate-700"
              >
                {/* Synchronous Direct HTML Inputs */}
                <input
                  id={orgFileInputId}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleOrgFilesSelected}
                />
                <input
                  id={orgFolderInputId}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  className="hidden"
                  onChange={handleOrgFilesSelected}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor={orgFolderInputId}
                    className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-950/40"
                  >
                    <FolderOpen className="w-4 h-4 text-blue-100" />
                    <span>Seleccionar Carpeta</span>
                  </label>

                  <label
                    htmlFor={orgFileInputId}
                    className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-blue-200 border border-slate-700 font-medium text-sm transition-all shadow-md"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>Seleccionar Archivos</span>
                  </label>

                  <span className="text-xs text-blue-300/70 ml-1">
                    {orgFiles.length > 0
                      ? `Carpeta: "${orgDirName || 'Seleccionada'}" (${orgFiles.length} archivos)`
                      : 'O arrastra una carpeta aquí'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    id="run-organize-btn"
                    onClick={runOrganize}
                    disabled={orgFiles.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white transition-all font-medium text-sm shadow-lg shadow-blue-950/50"
                  >
                    <FolderArchive className="w-4 h-4" />
                    <span>Organizar</span>
                  </button>

                  {organizedResult && (
                    <button
                      id="download-organized-btn"
                      onClick={downloadOrganizedZip}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-950/50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar ZIP organizado</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Categorization Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'Imagenes', label: 'Imágenes', icon: ImageIcon, color: 'text-amber-400' },
                  { key: 'Videos', label: 'Videos', icon: Film, color: 'text-purple-400' },
                  { key: 'Documentos', label: 'Documentos', icon: FileText, color: 'text-blue-400' },
                  { key: 'Datasets', label: 'Datasets', icon: Database, color: 'text-emerald-400' },
                  { key: 'Comprimidos', label: 'Comprimidos', icon: Archive, color: 'text-rose-400' },
                  { key: 'Otros', label: 'Otros', icon: FileIcon, color: 'text-slate-400' },
                ].map(({ key, label, icon: Icon, color }) => {
                  const count = organizedResult ? organizedResult[key]?.length || 0 : 0;
                  return (
                    <div
                      key={key}
                      className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg bg-slate-800/80 ${color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{label}</h4>
                          <p className="text-xs text-blue-300/50">Subcarpeta /{key}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-blue-200">{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Detailed organized files tree view */}
              <div className="flex-1 bg-slate-900/20 border border-slate-800/60 rounded-2xl p-4 overflow-y-auto min-h-[250px]">
                {!organizedResult ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-blue-300/40">
                    <FolderArchive className="w-12 h-12 mb-3 stroke-[1.5]" />
                    <p className="text-sm">
                      {orgFiles.length === 0
                        ? 'Selecciona una carpeta para organizarla en subcategorías.'
                        : 'Haz clic en "Organizar" para clasificar los archivos.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {Object.entries(organizedResult).map(
                      ([category, files]) =>
                        files.length > 0 && (
                          <div key={category} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                              <FolderOpen className="w-4 h-4 text-blue-400" />
                              <h3 className="text-sm font-bold text-blue-200">
                                /{category} <span className="text-xs text-blue-300/50">({files.length} archivos)</span>
                              </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                              {files.map((f) => (
                                <div
                                  key={f.id}
                                  className="bg-slate-900/60 border border-slate-800/60 rounded-lg px-3 py-2 flex items-center justify-between text-xs text-blue-200/90"
                                >
                                  <span className="truncate">{f.name}</span>
                                  <span className="text-[11px] text-blue-300/40 shrink-0 ml-2">
                                    {formatBytes(f.size)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 3: REDIMENSIONAR */}
          {activeTab === 'resize' && (
            <div id="view-resize" className="flex flex-col gap-6 h-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-blue-200 mb-1">Redimensionar Imágenes</h2>
                  <p className="text-sm text-blue-300/60">
                    Ajusta dimensiones en lote seleccionando una carpeta local de imágenes.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400/90 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1.5 rounded-lg w-fit">
                  <HardDrive className="w-4 h-4" />
                  <span>Sin carga a servidor • 100% Privado</span>
                </div>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleResDrop}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-5 transition-colors hover:border-slate-700"
              >
                {/* Synchronous Direct HTML Inputs */}
                <input
                  id={resFileInputId}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleResFilesSelected}
                />
                <input
                  id={resFolderInputId}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  className="hidden"
                  onChange={handleResFilesSelected}
                />

                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor={resFolderInputId}
                      className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-950/40"
                    >
                      <FolderOpen className="w-4 h-4 text-blue-100" />
                      <span>Seleccionar Carpeta</span>
                    </label>

                    <label
                      htmlFor={resFileInputId}
                      className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-blue-200 border border-slate-700 font-medium text-sm transition-all shadow-md"
                    >
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      <span>Seleccionar Imágenes</span>
                    </label>

                    <span className="text-xs text-blue-300/70 ml-1">
                      {resFiles.length > 0
                        ? `Carpeta: "${resDirName || 'Seleccionada'}" (${resFiles.length} imágenes)`
                        : 'O arrastra una carpeta de imágenes aquí'}
                    </span>
                  </div>

                  {resizedResults.length > 0 && (
                    <button
                      id="download-resized-zip-btn"
                      onClick={downloadResizedZip}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-950/50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar todas (.zip)</span>
                    </button>
                  )}
                </div>

                {/* Dimension Inputs */}
                <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <label htmlFor="width-input" className="text-xs font-semibold text-blue-300/80">Ancho:</label>
                    <input
                      id="width-input"
                      type="number"
                      value={widthVal}
                      onChange={(e) => setWidthVal(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-blue-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-blue-300/50">px</span>
                  </div>

                  <span className="text-blue-300/40 text-lg">×</span>

                  <div className="flex items-center gap-2">
                    <label htmlFor="height-input" className="text-xs font-semibold text-blue-300/80">Alto:</label>
                    <input
                      id="height-input"
                      type="number"
                      value={heightVal}
                      onChange={(e) => setHeightVal(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm font-mono text-blue-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-blue-300/50">px</span>
                  </div>

                  <button
                    id="run-resize-btn"
                    onClick={runResize}
                    disabled={resFiles.length === 0 || resizing}
                    className="ml-auto inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-medium text-sm transition-all shadow-md"
                  >
                    <Crop className="w-4 h-4" />
                    <span>{resizing ? 'Redimensionando...' : 'Redimensionar imágenes'}</span>
                  </button>
                </div>
              </div>

              {/* Resized Images Gallery Preview */}
              <div className="flex-1 bg-slate-900/20 border border-slate-800/60 rounded-2xl p-4 overflow-y-auto min-h-[300px]">
                {resizedResults.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-blue-300/40">
                    <ImageIcon className="w-12 h-12 mb-3 stroke-[1.5]" />
                    <p className="text-sm">
                      {resFiles.length === 0
                        ? 'Selecciona una carpeta con imágenes para modificar sus dimensiones.'
                        : 'Haz clic en "Redimensionar imágenes" para procesarlas.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resizedResults.map((res, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-3"
                      >
                        <div className="h-44 bg-black/60 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800/80">
                          <img
                            src={res.resizedUrl}
                            alt={res.newName}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-white truncate">{res.newName}</p>
                            <p className="text-blue-300/50">
                              {res.width} × {res.height} px • {formatBytes(res.resizedBlob.size)}
                            </p>
                          </div>

                          <a
                            href={res.resizedUrl}
                            download={res.newName}
                            className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition-all shrink-0"
                            title="Descargar esta imagen"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 4: RENOMBRAR */}
          {activeTab === 'rename' && (
            <div id="view-rename" className="flex flex-col gap-6 h-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-blue-200 mb-1">Renombrar Archivos en Serie</h2>
                  <p className="text-sm text-blue-300/60">
                    Renombra archivos secuencialmente usando un nombre base personalizado.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400/90 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1.5 rounded-lg w-fit">
                  <HardDrive className="w-4 h-4" />
                  <span>Sin carga a servidor • 100% Privado</span>
                </div>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleRenDrop}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-4 transition-colors hover:border-slate-700"
              >
                {/* Synchronous Direct HTML Inputs */}
                <input
                  id={renFileInputId}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleRenFilesSelected}
                />
                <input
                  id={renFolderInputId}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  multiple
                  className="hidden"
                  onChange={handleRenFilesSelected}
                />

                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor={renFolderInputId}
                      className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-950/40"
                    >
                      <FolderOpen className="w-4 h-4 text-blue-100" />
                      <span>Seleccionar Carpeta</span>
                    </label>

                    <label
                      htmlFor={renFileInputId}
                      className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-blue-200 border border-slate-700 font-medium text-sm transition-all shadow-md"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Seleccionar Archivos</span>
                    </label>

                    <span className="text-xs text-blue-300/70 ml-1">
                      {renFiles.length > 0
                        ? `Carpeta: "${renDirName || 'Seleccionada'}" (${renFiles.length} archivos)`
                        : 'O arrastra una carpeta aquí'}
                    </span>
                  </div>

                  {renamedPreview.length > 0 && (
                    <button
                      id="download-renamed-btn"
                      onClick={downloadRenamedZip}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-medium text-sm transition-all shadow-lg shadow-blue-950/50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Renombrar y descargar (.zip)</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 pt-2">
                  <label htmlFor="base-name-input" className="text-xs font-semibold text-blue-200">
                    Nombre base:
                  </label>
                  <input
                    id="base-name-input"
                    type="text"
                    value={baseName}
                    placeholder="Ej: Documento Proyecto"
                    onChange={(e) => handleBaseNameChange(e.target.value)}
                    className="w-full md:w-80 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-blue-100 placeholder-blue-300/30 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Preview Table for Batch Renaming */}
              <div className="flex-1 bg-slate-900/20 border border-slate-800/60 rounded-2xl p-4 overflow-y-auto min-h-[300px]">
                {renFiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-blue-300/40">
                    <Edit3 className="w-12 h-12 mb-3 stroke-[1.5]" />
                    <p className="text-sm">
                      Selecciona una carpeta e ingresa un nombre base para previsualizar los nuevos nombres secuenciales.
                    </p>
                  </div>
                ) : !baseName.trim() ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-blue-300/50">
                    <AlertCircle className="w-10 h-10 mb-2 text-amber-400" />
                    <p className="text-sm">Por favor, ingresa un nombre base para generar la secuencia.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 px-3 py-2 text-xs font-semibold text-blue-300/60 border-b border-slate-800">
                      <span>Nombre original</span>
                      <span>Nuevo nombre secuencial</span>
                    </div>

                    {renamedPreview.map((pair, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-2 px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs text-blue-100 items-center hover:bg-slate-800/50 transition-all"
                      >
                        <span className="truncate pr-2 text-blue-300/80">{pair.item.name}</span>
                        <div className="flex items-center gap-2 text-emerald-400 font-medium truncate">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{pair.newName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
