import { PDFDocument } from 'pdf-lib';

const A4_W = 595;
const A4_H = 842;
const MARGIN = 20;

export async function imagesToPdf(imageUrls: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (const url of imageUrls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`image fetch ${url} failed: ${res.status}`);

    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get('content-type') ?? 'image/jpeg';

    let img;
    if (ct.includes('png')) {
      img = await pdf.embedPng(bytes);
    } else if (ct.includes('webp')) {
      // pdf-lib doesn't support webp; fetch as-is will fail — force jpg
      throw new Error('webp not supported, ask for jpeg');
    } else {
      img = await pdf.embedJpg(bytes);
    }

    const page = pdf.addPage([A4_W, A4_H]);
    const scale = Math.min(
      (A4_W - MARGIN * 2) / img.width,
      (A4_H - MARGIN * 2) / img.height
    );
    const w = img.width * scale;
    const h = img.height * scale;

    page.drawImage(img, {
      x: (A4_W - w) / 2,
      y: (A4_H - h) / 2,
      width: w,
      height: h,
    });
  }

  return pdf.save();
}

export function pdfToDataUrl(bytes: Uint8Array): string {
  return 'data:application/pdf;base64,' + Buffer.from(bytes).toString('base64');
}