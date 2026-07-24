// utils/cleanup.js
import fs from 'fs';
import path from 'path';

const clearUploadsFolder = () => {
    const dir = path.join(process.cwd(), 'uploads');
    fs.readdir(dir, (err, files) => {
        if (err) return;
        for (const file of files) {
            fs.unlink(path.join(dir, file), () => { });
        }
    });
};


export default clearUploadsFolder;