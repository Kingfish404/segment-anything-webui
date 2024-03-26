import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from "formidable";
import { promises as fs } from 'fs';

export const TMP_DIR = './tmp/'

export async function parser_fields_and_file(req: NextApiRequest) {
    fs.mkdir('./tmp/', { recursive: true })
    const form = formidable({ uploadDir: TMP_DIR, maxTotalFileSize: 2 * 1024 * 1024 })
    const { fields, files } =
        await new Promise<{ fields: formidable.Fields; files: formidable.Files; }>((resolve, reject) => {
            form.parse(req, async function (err, fields, files) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ fields, files });
            });
        })
    return { fields, files }
}