export type ExportCell = string | number;

function escapeHtml(value: ExportCell): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tableHtml(rows: ExportCell[][]): string {
  return `
    <table>
      <tbody>
        ${rows.map(row => `
          <tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>`;
}

export function downloadExcel(rows: ExportCell[][], filename: string): void {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"></head>
      <body>${tableHtml(rows)}</body>
    </html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printPdf(title: string, bodyHtml: string): void {
  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) return;
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { font-size: 20px; margin: 0 0 6px; }
          h2 { font-size: 15px; margin: 22px 0 8px; }
          p { margin: 0 0 12px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 12px; }
          th { background: #f1f5f9; text-align: left; }
          td.num, th.num { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          .total td { font-weight: 700; background: #f8fafc; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
