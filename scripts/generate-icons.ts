import { copyFile, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  await copyFile("apps/web/public/icon.svg", "apps/landing/public/icon.svg");
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    const svg = await readFile("apps/web/public/icon.svg", "utf8");
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d")?.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size },
    );
    for (const app of ["web", "landing"])
      await writeFile(`apps/${app}/public/icon-${size}.png`, Buffer.from(data, "base64"));
  }
} finally {
  await browser.close();
}
