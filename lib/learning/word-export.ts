import { Document, HeadingLevel, Packer, Paragraph, TextRun, ExternalHyperlink } from "docx";
import type { LearningSummary } from "./summary";
export function summaryDocument(summary: LearningSummary) {
  const paragraph = (text: string) => new Paragraph({ spacing: { after: 160, line: 280 }, children: text.split(/(https:\/\/\S+)/).flatMap<TextRun | ExternalHyperlink>(part => part.startsWith("https://") ? [new ExternalHyperlink({ link: part, children: [new TextRun({ text: part, style: "Hyperlink" })] })] : part.split("\n").map((line, i) => new TextRun({ text: line, break: i ? 1 : 0 }))) });
  return new Document({ title: summary.title, creator: "Heart Anatomy Learning Explorer", description: "Recorded learning activity and verified source excerpts", styles: { default: { document: { run: { font: "Calibri", size: 22, color: "000000" }, paragraph: { spacing: { after: 160 } } } }, paragraphStyles: [
    { id: "Title", name: "Title", basedOn: "Normal", run: { size: 36, bold: true, color: "000000" }, paragraph: { spacing: { after: 240 }, keepNext: true } },
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", run: { size: 28, bold: true, color: "000000" }, paragraph: { spacing: { before: 240, after: 160 }, keepNext: true } },
  ] }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children: [
    new Paragraph({ text: summary.title, heading: HeadingLevel.TITLE }), paragraph(summary.kind),
    ...summary.sections.flatMap(s => [new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }), ...s.paragraphs.map(paragraph)]),
  ] }] });
}
export async function downloadSummary(summary: LearningSummary, signal?: AbortSignal) {
  const blob = await Packer.toBlob(summaryDocument(summary));
  signal?.throwIfAborted();
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = `Heart_Anatomy_Session_Summary_${summary.date}.docx`;
  link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
