import AdmZip from "adm-zip";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { files } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const zip = new AdmZip();
    files.forEach((f) => {
      if (!f || !f.name || typeof f.content !== "string") return;
      zip.addFile(f.name, Buffer.from(f.content, "utf8"));
    });

    const zipBuffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=exported-pages.zip"
    );
    return res.status(200).send(zipBuffer);
  } catch (e) {
    console.error("export-zip error", e);
    return res.status(500).json({ error: "Failed to create zip" });
  }
}
