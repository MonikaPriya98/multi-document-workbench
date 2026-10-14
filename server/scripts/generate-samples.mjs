import fs from "node:fs";
import path from "node:path";

const output = path.resolve(process.cwd(), "../samples/supporting-document.pdf");
const lines = [
  "Company Name: Northstar Analytics Ltd", "Registration Number: NS-20418",
  "Effective Date: 20 January 2026", "Address: 17 Harbour Road, Bristol BS1 5TT",
  "Director: Elena Morris", "Net Income: $318,000",
  "Obligation: Maintain accurate records for seven years."
];
const escapePdf = (value) => value.replace(/([\\()])/g, "\\$1");
const commands = ["BT", "/F1 20 Tf", "54 730 Td", `(Supporting Company Record) Tj`, "/F1 12 Tf", ...lines.flatMap(line => ["0 -32 Td", `(${escapePdf(line)}) Tj`]), "ET"].join("\n");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, pdf, "binary");
console.log(`Generated ${output}`);
