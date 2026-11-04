// Crea una miniatura pequeña (máx. 160 px) de una imagen.
// Una foto del celular puede tener 12 megapíxeles: mostrarla en un cuadrito
// de 44 px obliga al celular a descomprimirla entera, y con varias fotos la
// app se vuelve lenta. Con la miniatura, la lista carga al instante.
export async function makeThumbnail(file: Blob, size = 160): Promise<Blob | undefined> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return undefined
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return await new Promise<Blob | undefined>((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), 'image/webp', 0.8))
  } catch {
    return undefined // Formato que el navegador no sabe abrir (por ejemplo, HEIC): se muestra el ícono.
  }
}
