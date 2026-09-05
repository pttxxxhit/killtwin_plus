// Utility to generate realistic mock test files for all 4 functions
// Allows instant testing on both PC, Mobile, and Android APK without manual file picking

export interface SampleFileDef {
  name: string;
  content: string | Uint8Array;
  type: string;
}

// Generate an SVG or binary image buffer for test images
function createTestImageBlob(label: string, color: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${color}"/>
    <circle cx="200" cy="150" r="80" fill="white" opacity="0.2"/>
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="bold" fill="white">${label}</text>
    <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="white" opacity="0.9">Archivo de Prueba KillTwin</text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

// 1. GENERATE SAMPLE DUPLICATES
// Produces 8 files containing 3 pairs of identical files (6 duplicates) and 2 unique files
export async function generateSampleDuplicates(): Promise<File[]> {
  const textContentA = '=== REPORTE FINANCIERO ANUAL PTTECH 2024 ===\nIngresos: $45.200.000\nGastos: $18.400.000\nBalance neto: $26.800.000\nDocumento verificado.';
  const textContentB = 'CONTRATO DE PRESTACION DE SERVICIOS TECNOLOGICOS\nEntre PTTECH Corp y el cliente asociado.\nClausula 1: Procesamiento de archivos local sin envio a servidores.';
  const textContentC = 'NOTAS DE REUNION - PLANIFICACION KILLTWIN\nObjetivo: Optimizar rendimiento en dispositivos moviles y APK Android.';
  const textContentD = 'PRESENTACION EJECUTIVA ESTRATEGIA 2024-2025\nDiapositiva 1: Crecimiento de automatizaciones de oficina.';

  // Attempt to fetch pug image for realistic image duplicate, or fallback to generated blob
  let pugBlob: Blob;
  try {
    const res = await fetch('/perfil.png');
    if (res.ok) {
      pugBlob = await res.blob();
    } else {
      pugBlob = createTestImageBlob('Foto Pug Perfil', '#653B26');
    }
  } catch {
    pugBlob = createTestImageBlob('Foto Pug Perfil', '#653B26');
  }

  // Create exact duplicate pairs using identical blobs
  const file1 = new File([textContentA], 'Reporte_Financiero_2024.pdf', { type: 'application/pdf' });
  const file1Dup = new File([textContentA], 'Copia de Reporte_Financiero_2024.pdf', { type: 'application/pdf' });

  const file2 = new File([pugBlob], 'foto_perfil_pug.png', { type: 'image/png' });
  const file2Dup = new File([pugBlob], 'foto_perfil_pug (1).png', { type: 'image/png' });

  const file3 = new File([textContentB], 'Contrato_Servicios_Firmado.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const file3Dup = new File([textContentB], 'Contrato_Servicios_Firmado_respaldo.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  const file4Unique = new File([textContentC], 'Notas_Reunion_Estrategica.txt', { type: 'text/plain' });
  const file5Unique = new File([textContentD], 'Presentacion_Final_PTTECH.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });

  return [file1, file1Dup, file2, file2Dup, file3, file3Dup, file4Unique, file5Unique];
}

// 2. GENERATE SAMPLE FILES FOR ORGANIZING
// Produces files spanning all categories: Imagenes, Documentos, Datasets, Videos, Comprimidos
export async function generateSampleOrganize(): Promise<File[]> {
  const img1 = new File([createTestImageBlob('Foto Vacaciones', '#1E40AF')], 'vacaciones_verano.jpg', { type: 'image/jpeg' });
  const img2 = new File([createTestImageBlob('Captura Pantalla', '#047857')], 'captura_grafico.png', { type: 'image/png' });

  const doc1 = new File(['Informe de Gestion 2024\nResultados excelentes.'], 'informe_gestion_anual.pdf', { type: 'application/pdf' });
  const doc2 = new File(['Guia de usuario KillTwin\nInstrucciones para APK y Windows.'], 'manual_usuario.docx', { type: 'application/msword' });

  const data1 = new File(['ID,Nombre,Email,Ventas\n1,Juan,juan@pttech.cl,120\n2,Maria,maria@pttech.cl,250'], 'base_clientes.csv', { type: 'text/csv' });
  const data2 = new File(['Balance trimestral en formato Excel'], 'metricas_q3.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const vid1 = new File(['Contenido simulado de video MP4'], 'demo_producto_killtwin.mp4', { type: 'video/mp4' });
  const zip1 = new File(['Archivo comprimido ZIP de prueba'], 'respaldo_antiguo_2023.zip', { type: 'application/zip' });

  return [img1, img2, doc1, doc2, data1, data2, vid1, zip1];
}

// 3. GENERATE SAMPLE IMAGES FOR RESIZING
export async function generateSampleResize(): Promise<File[]> {
  try {
    const res = await fetch('/perfil.png');
    if (res.ok) {
      const blob = await res.blob();
      return [new File([blob], 'cara_pug_avatar.png', { type: 'image/png' })];
    }
  } catch {
    // fallback below
  }
  const fallbackBlob = createTestImageBlob('Cara Pug Avatar', '#653B26');
  return [new File([fallbackBlob], 'cara_pug_avatar.png', { type: 'image/png' })];
}

// 4. GENERATE SAMPLE FILES FOR BATCH RENAMING
export function generateSampleRename(): File[] {
  return [
    new File(['IMG_0084 data'], 'IMG_0084_RAW.jpg', { type: 'image/jpeg' }),
    new File(['IMG_0085 data'], 'IMG_0085_RAW.jpg', { type: 'image/jpeg' }),
    new File(['IMG_0086 data'], 'IMG_0086_RAW.jpg', { type: 'image/jpeg' }),
    new File(['SCAN_0110 data'], 'SCAN_0110_recibo.pdf', { type: 'application/pdf' }),
    new File(['SCAN_0111 data'], 'SCAN_0111_factura.pdf', { type: 'application/pdf' }),
  ];
}
