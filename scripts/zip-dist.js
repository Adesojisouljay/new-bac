import fs from 'fs';
import archiver from 'archiver';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read the frontend version
const pkgPath = path.join(__dirname, '../package.json');
const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkgData.version || '1.0.0';

// 2. Setup the output paths in the Setup Platform's public folder
const setupPublicDir = path.join(__dirname, '../../bac-community-setup/public');
if (!fs.existsSync(setupPublicDir)) {
    fs.mkdirSync(setupPublicDir, { recursive: true });
}

const zipFilename = `dist-v${version}.zip`;
const outputPath = path.join(setupPublicDir, zipFilename);
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
});

// listen for all archive data to be written
output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    console.log(`Engine packaged and ${zipFilename} securely saved to bac-community-setup/public.`);

    // 3. Update the releases.json manifest
    const manifestPath = path.join(setupPublicDir, 'releases.json');
    let releases = [];

    if (fs.existsSync(manifestPath)) {
        try {
            releases = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (e) {
            console.error("Failed to parse existing releases.json, starting fresh.");
        }
    }

    // Remove existing entry for this version to overwrite
    releases = releases.filter(r => r.version !== version);

    // Add new release entry
    releases.unshift({
        version: version,
        filename: zipFilename,
        date: new Date().toISOString(),
        changelog: "New release. Build automatically generated from continuous integration pipeline."
    });

    fs.writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
    console.log(`Updated releases.json with version ${version}.`);
});

// catch warnings
archive.on('warning', function (err) {
    if (err.code === 'ENOENT') {
        console.warn(err);
    } else {
        throw err;
    }
});

// catch errors
archive.on('error', function (err) {
    throw err;
});

// pipe archive data to the file
archive.pipe(output);

// append files from dist sub-directory
archive.directory(path.join(__dirname, '../dist'), false);

// finalize the archive
archive.finalize();
