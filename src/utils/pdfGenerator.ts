import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface PDFExportOptions {
  title?: string;
  author?: string;
  subject?: string;
  fileName?: string;
}

/**
 * Escape HTML characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format inline markdown like bold, italics, inline code, and links
 */
function formatInline(text: string): string {
  let escaped = escapeHtml(text);
  // Bold: **text** or __text__
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700; color:#0f172a;">$1</strong>');
  escaped = escaped.replace(/__(.+?)__/g, '<strong style="font-weight:700; color:#0f172a;">$1</strong>');
  // Italic: *text* or _text_
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em style="color:#334155;">$1</em>');
  escaped = escaped.replace(/_([^_]+)_/g, '<em style="color:#334155;">$1</em>');
  // Inline Code: `text`
  escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:#f3e8ff; color:#6b21a8; padding:2px 6px; border-radius:4px; font-size:12px; font-family:Consolas, Monaco, monospace; border:1px solid #e9d5ff;">$1</code>');
  return escaped;
}

/**
 * Convert markdown string into clean, styled HTML suitable for high-fidelity PDF rendering
 */
function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" = "ul";
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList) {
      htmlParts.push(`</${listType}>`);
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      let tblHtml = '<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; break-inside:avoid; page-break-inside:avoid;">';
      tableRows.forEach((row, rIdx) => {
        if (rIdx === 0) {
          tblHtml += '<thead style="background:#f1f5f9;"><tr>';
          row.forEach((cell) => {
            tblHtml += `<th style="border:1px solid #cbd5e1; padding:8px 12px; font-weight:700; text-align:left; color:#1e293b;">${formatInline(cell)}</th>`;
          });
          tblHtml += '</tr></thead><tbody>';
        } else {
          tblHtml += `<tr style="${rIdx % 2 === 0 ? 'background:#f8fafc;' : 'background:#ffffff;'}">`;
          row.forEach((cell) => {
            tblHtml += `<td style="border:1px solid #e2e8f0; padding:8px 12px; color:#334155;">${formatInline(cell)}</td>`;
          });
          tblHtml += '</tr>';
        }
      });
      tblHtml += '</tbody></table>';
      htmlParts.push(tblHtml);
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block toggle
    if (trimmed.startsWith("```")) {
      flushList();
      flushTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        const codeText = escapeHtml(codeBlockContent.join("\n"));
        htmlParts.push(`
          <div style="background:#0f172a; color:#f1f5f9; border-radius:8px; padding:12px 16px; margin:14px 0; font-family:Consolas, Monaco, 'Courier New', monospace; font-size:12px; line-height:1.5; border:1px solid #1e293b; break-inside:avoid; page-break-inside:avoid;">
            ${codeBlockLang ? `<div style="font-size:10px; text-transform:uppercase; color:#a78bfa; margin-bottom:6px; font-weight:700; border-bottom:1px solid #334155; padding-bottom:3px;">${escapeHtml(codeBlockLang)}</div>` : ""}
            <pre style="margin:0; white-space:pre-wrap; word-break:break-word; font-family:inherit;"><code>${codeText}</code></pre>
          </div>
        `);
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // Table rows
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        continue; // table header divider
      }
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      inTable = true;
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    // Blank line
    if (!trimmed) {
      flushList();
      htmlParts.push('<div style="height:8px;"></div>');
      continue;
    }

    // Horizontal divider
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      htmlParts.push('<hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;" />');
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      flushList();
      htmlParts.push(`<h1 style="font-size:21px; font-weight:700; color:#4c1d95; margin:20px 0 10px 0; line-height:1.3; border-bottom:2px solid #ede9fe; padding-bottom:6px; break-inside:avoid; page-break-inside:avoid;">${formatInline(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      htmlParts.push(`<h2 style="font-size:17.5px; font-weight:700; color:#5b21b6; margin:16px 0 8px 0; line-height:1.35; break-inside:avoid; page-break-inside:avoid;">${formatInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushList();
      htmlParts.push(`<h3 style="font-size:15px; font-weight:600; color:#6d28d9; margin:14px 0 6px 0; line-height:1.4; break-inside:avoid; page-break-inside:avoid;">${formatInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      flushList();
      htmlParts.push(`<h4 style="font-size:13.5px; font-weight:600; color:#7c3aed; margin:12px 0 4px 0;">${formatInline(trimmed.slice(5))}</h4>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushList();
      htmlParts.push(`<blockquote style="border-left:4px solid #8b5cf6; background:#f5f3ff; margin:12px 0; padding:10px 14px; border-radius:0 6px 6px 0; color:#475569; font-style:italic; font-size:13px; line-height:1.55; break-inside:avoid; page-break-inside:avoid;">${formatInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered List item
    if (/^[-*+•]\s+/.test(trimmed)) {
      if (!inList || listType !== "ul") {
        flushList();
        htmlParts.push('<ul style="margin:8px 0; padding-left:22px; list-style-type:disc;">');
        inList = true;
        listType = "ul";
      }
      const itemContent = trimmed.replace(/^[-*+•]\s+/, "");
      htmlParts.push(`<li style="margin-bottom:6px; color:#1e293b; font-size:13.5px; line-height:1.6;">${formatInline(itemContent)}</li>`);
      continue;
    }

    // Ordered List item
    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      if (!inList || listType !== "ol") {
        flushList();
        htmlParts.push('<ol style="margin:8px 0; padding-left:22px; list-style-type:decimal;">');
        inList = true;
        listType = "ol";
      }
      const itemContent = trimmed.replace(/^\d+[\.\)]\s+/, "");
      htmlParts.push(`<li style="margin-bottom:6px; color:#1e293b; font-size:13.5px; line-height:1.6;">${formatInline(itemContent)}</li>`);
      continue;
    }

    // Regular Paragraph
    flushList();
    htmlParts.push(`<p style="margin:0 0 10px 0; color:#1e293b; font-size:13.5px; line-height:1.65; word-break:break-word;">${formatInline(trimmed)}</p>`);
  }

  flushList();
  flushTable();
  return htmlParts.join("\n");
}

/**
 * Generate and download a formatted, Unicode/Devanagari-safe PDF from an AI response or document
 */
export async function exportResponseToPDF(
  content: string,
  options: PDFExportOptions = {}
): Promise<boolean> {
  let container: HTMLDivElement | null = null;
  try {
    const titleText = options.title || "Avani AI (अवनी) - Document Export";
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const parsedBodyHtml = markdownToHtml(content);

    // Create an isolated rendering DOM container with full Unicode font support
    container = document.createElement("div");
    container.id = "avani-pdf-export-container";
    container.style.position = "fixed";
    container.style.top = "-99999px";
    container.style.left = "-99999px";
    container.style.width = "794px"; // Standard A4 width at 96 DPI
    container.style.backgroundColor = "#ffffff";
    container.style.color = "#1e293b";
    container.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Devanagari', 'Noto Sans', sans-serif";
    container.style.boxSizing = "border-box";
    container.style.zIndex = "-1000";

    container.innerHTML = `
      <div style="background: linear-gradient(135deg, #1e1b4b 0%, #3b0764 50%, #4c1d95 100%); color: #ffffff; padding: 22px 32px; border-bottom: 3px solid #8b5cf6;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 19px; font-weight: 700; color: #ffffff; line-height: 1.2;">
              ${escapeHtml(titleText)}
            </h1>
            <div style="margin-top: 5px; font-size: 11px; color: #e2e8f0; opacity: 0.9;">
              Generated on: ${escapeHtml(dateStr)}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 6px; font-size: 11px; color: #ffffff; font-weight: 600; border: 1px solid rgba(255,255,255,0.25);">
              Avani AI
            </div>
          </div>
        </div>
      </div>

      <div style="padding: 26px 36px 18px 36px; min-height: 980px;">
        ${parsedBodyHtml}
      </div>

      <div style="padding: 14px 36px 20px 36px; border-top: 1px solid #e2e8f0; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
        <div>
          Generated by <strong>Avani AI</strong> • Created by Vinay Pratap Shankar (Founder, MG Shankar Tech)
        </div>
        <div style="font-weight: 500;">
          Document Export
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Render using html2canvas with scale 2 for crisp vector-like text
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    const imgWidth = 210; // A4 mm
    const pageHeightMm = 297; // A4 mm
    const pageCanvasHeight = (canvas.width * pageHeightMm) / imgWidth;
    const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        doc.addPage();
      }

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageCanvasHeight;
      const ctx = pageCanvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        const sourceY = page * pageCanvasHeight;
        const remainingHeight = canvas.height - sourceY;
        const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);

        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
      }

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      doc.addImage(imgData, "JPEG", 0, 0, imgWidth, pageHeightMm, undefined, "FAST");
    }

    const safeFileName = (options.fileName || "Avani_AI_Export")
      .replace(/[^a-zA-Z0-9_\u0900-\u097F-]/g, "_")
      .substring(0, 45);

    doc.save(`${safeFileName}.pdf`);
    return true;
  } catch (error) {
    console.error("PDF generation failed:", error);
    return false;
  } finally {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Generate and download a full chat conversation history as a formatted, Unicode-safe PDF
 */
export async function exportConversationToPDF(
  messages: Array<{ role: "user" | "assistant"; content: string; timestamp?: string }>,
  sessionTitle: string = "Avani AI Conversation"
): Promise<boolean> {
  let container: HTMLDivElement | null = null;
  try {
    const dateStr = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    let convoHtml = "";
    for (const msg of messages) {
      const isUser = msg.role === "user";
      const senderName = isUser ? "You" : "Avani AI (अवनी)";
      const senderBadgeColor = isUser ? "background:#ede9fe; color:#6d28d9; border:1px solid #ddd6fe;" : "background:#ccfbf1; color:#0f766e; border:1px solid #99f6e4;";
      const bubbleBg = isUser ? "background:#f8fafc; border:1px solid #e2e8f0;" : "background:#ffffff; border:1px solid #ede9fe;";
      const contentHtml = markdownToHtml(msg.content);

      convoHtml += `
        <div style="margin-bottom: 16px; border-radius: 8px; ${bubbleBg} padding: 14px 18px; break-inside: avoid; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; ${senderBadgeColor}">
              ${escapeHtml(senderName)}
            </span>
            ${msg.timestamp ? `<span style="font-size: 10px; color: #94a3b8;">${escapeHtml(msg.timestamp)}</span>` : ""}
          </div>
          <div>
            ${contentHtml}
          </div>
        </div>
      `;
    }

    container = document.createElement("div");
    container.id = "avani-pdf-convo-export-container";
    container.style.position = "fixed";
    container.style.top = "-99999px";
    container.style.left = "-99999px";
    container.style.width = "794px";
    container.style.backgroundColor = "#ffffff";
    container.style.color = "#1e293b";
    container.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Devanagari', 'Noto Sans', sans-serif";
    container.style.boxSizing = "border-box";
    container.style.zIndex = "-1000";

    container.innerHTML = `
      <div style="background: linear-gradient(135deg, #1e1b4b 0%, #3b0764 50%, #4c1d95 100%); color: #ffffff; padding: 22px 32px; border-bottom: 3px solid #8b5cf6;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 19px; font-weight: 700; color: #ffffff; line-height: 1.2;">
              ${escapeHtml(sessionTitle)}
            </h1>
            <div style="margin-top: 5px; font-size: 11px; color: #e2e8f0; opacity: 0.9;">
              Chat Transcript • Exported on ${escapeHtml(dateStr)}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 6px; font-size: 11px; color: #ffffff; font-weight: 600; border: 1px solid rgba(255,255,255,0.25);">
              Avani AI
            </div>
          </div>
        </div>
      </div>

      <div style="padding: 26px 36px 18px 36px; min-height: 980px;">
        ${convoHtml}
      </div>

      <div style="padding: 14px 36px 20px 36px; border-top: 1px solid #e2e8f0; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
        <div>
          Generated by <strong>Avani AI</strong> • Created by Vinay Pratap Shankar (Founder, MG Shankar Tech)
        </div>
        <div style="font-weight: 500;">
          Transcript Export
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
    });

    const imgWidth = 210;
    const pageHeightMm = 297;
    const pageCanvasHeight = (canvas.width * pageHeightMm) / imgWidth;
    const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        doc.addPage();
      }

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageCanvasHeight;
      const ctx = pageCanvas.getContext("2d");

      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        const sourceY = page * pageCanvasHeight;
        const remainingHeight = canvas.height - sourceY;
        const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);

        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
      }

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      doc.addImage(imgData, "JPEG", 0, 0, imgWidth, pageHeightMm, undefined, "FAST");
    }

    const safeTitle = sessionTitle.replace(/[^a-zA-Z0-9_\u0900-\u097F-]/g, "_").substring(0, 35);
    doc.save(`${safeTitle}.pdf`);
    return true;
  } catch (err) {
    console.error("Conversation PDF export failed:", err);
    return false;
  } finally {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Clean markdown for plain text file export
 */
export function cleanMarkdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+(.*)$/gm, "$1\n" + "=".repeat(20))
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\w]*\n([\s\S]*?)```/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ");
}

/**
 * Generate and download plain text file (.txt)
 */
export function exportResponseToText(content: string, fileName?: string): boolean {
  try {
    const plainText = `Avani AI - Document Export\nGenerated on: ${new Date().toLocaleString()}\n\n${content}\n\n---\nGenerated by Avani AI • Created by Vinay Pratap Shankar (Founder, MG Shankar Tech)`;
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (fileName || "Avani_AI_Export")
      .replace(/[^a-zA-Z0-9_\u0900-\u097F-]/g, "_")
      .substring(0, 45);
    link.href = url;
    link.download = `${safeName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("Text export failed:", err);
    return false;
  }
}

/**
 * Export conversation to plain text file (.txt)
 */
export function exportConversationToText(
  messages: Array<{ role: "user" | "assistant"; content: string; timestamp?: string }>,
  sessionTitle: string = "Avani AI Conversation"
): boolean {
  try {
    let textOutput = `====================================================\n`;
    textOutput += `${sessionTitle}\n`;
    textOutput += `Avani AI Chat Transcript • Exported on ${new Date().toLocaleString()}\n`;
    textOutput += `====================================================\n\n`;

    for (const msg of messages) {
      const sender = msg.role === "user" ? "You" : "Avani AI (अवनी)";
      const time = msg.timestamp ? ` [${msg.timestamp}]` : "";
      textOutput += `----------------------------------------------------\n`;
      textOutput += `${sender}${time}:\n`;
      textOutput += `----------------------------------------------------\n`;
      textOutput += `${msg.content}\n\n`;
    }

    textOutput += `\n====================================================\n`;
    textOutput += `Generated by Avani AI • Created by Vinay Pratap Shankar (Founder, MG Shankar Tech)\n`;
    textOutput += `====================================================\n`;

    const blob = new Blob([textOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = sessionTitle.replace(/[^a-zA-Z0-9_\u0900-\u097F-]/g, "_").substring(0, 35);
    link.href = url;
    link.download = `${safeTitle}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("Conversation text export failed:", err);
    return false;
  }
}

