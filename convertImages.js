const fs = require("fs");
const path = require("path");
const { readdir } = require("node:fs/promises");
const imageToBase64 = require("image-to-base64");

const srcDir = path.join(__dirname, "src"); // HTML files
const publicDir = path.join(__dirname, "public"); // images
const outPutDirHtml = path.join(__dirname, "convert_html"); // output dir
const outputJson = path.join(__dirname, "imagesBase64.json"); // JSON with base64

const imagesBase64 = {};

if (!fs.existsSync(outPutDirHtml)) {
  fs.mkdirSync(outPutDirHtml, { recursive: true });
}

const getFilesWithExtension = async (dir, extension = "") => {
  const files = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      const nestedFiles = await getFilesWithExtension(filePath, extension);
      result.push(...nestedFiles);
    } else if (
      !extension ||
      path.extname(file.name).toLowerCase() === extension
    ) {
      result.push(filePath);
    }
  }
  return result;
};

const convertImagesToJson = async (dir, outputJsonPath) => {
  const files = await getFilesWithExtension(dir);

  const promises = files.map(async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".svg") {
      const data = await fs.promises.readFile(filePath, "utf8");
      const base64 = Buffer.from(data).toString("base64");
      imagesBase64[filePath] = `data:image/svg+xml;base64,${base64}`;
    } else if ([".png", ".jpg", ".jpeg"].includes(ext)) {
      const base64String = await imageToBase64(filePath);
      imagesBase64[filePath] = `data:image/${ext.slice(
        1
      )};base64,${base64String}`;
    }
  });

  await Promise.all(promises);

  await fs.promises.writeFile(
    outputJsonPath,
    JSON.stringify(imagesBase64, null, 2),
    "utf8"
  );
};

const replaceSrcWithBase64 = async (
  inputHtmlPath,
  outputHtmlPath,
  imagesBase64
) => {
  const data = await fs.promises.readFile(inputHtmlPath, "utf8");
  let updatedHtml = data;

  for (const [filePath, base64] of Object.entries(imagesBase64)) {
    const relativePath = path.relative(publicDir, filePath).replace(/\\/g, "/");

    //replace src in img
    const srcRegex = new RegExp(
      `src=["']\\.\\.\\/public\\/${relativePath}["']`,
      "g"
    );
    updatedHtml = updatedHtml.replace(srcRegex, `src="${base64}"`);

    //replace src in background
    const bgRegex = new RegExp(
      `background:\\s*url\\(["']?\\.\\.\\/public\\/${relativePath}['"]?\\)`,
      "g"
    );
    updatedHtml = updatedHtml.replace(bgRegex, `background: url('${base64}')`);
  }

  await fs.promises.writeFile(outputHtmlPath, updatedHtml, "utf8");
};

const processHtmlFiles = async () => {
  try {
    // 1. convert img to base64 and save to JSON
    await convertImagesToJson(publicDir, outputJson);

    // 2. reed HTML and replace src to base64
    const htmlFiles = await getFilesWithExtension(srcDir, ".html");

    for (const inputHtmlPath of htmlFiles) {
      const outputHtmlPath = path.join(
        outPutDirHtml,
        path.basename(inputHtmlPath)
      );
      await replaceSrcWithBase64(inputHtmlPath, outputHtmlPath, imagesBase64);
    }
  } catch (error) {
    console.error(`Ошибка: ${error.message}`);
  }
};

processHtmlFiles();
