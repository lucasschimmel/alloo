export async function prepareAvatar(file: File) {
  if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("INVALID_IMAGE");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("INVALID_IMAGE");
    const size = Math.min(image.width, image.height);
    ctx.drawImage(
      image,
      (image.width - size) / 2,
      (image.height - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("INVALID_IMAGE"))),
        "image/png",
      ),
    );
    return blob.arrayBuffer();
  } finally {
    image.close();
  }
}
