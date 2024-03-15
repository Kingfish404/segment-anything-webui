// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import formidable from "formidable";
import { promises as fs } from 'fs';
import * as utils from '@/utils';
import * as utils_api from '@/utils_api';

export const config = {
    api: {
        bodyParser: false
    }
};


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Response>) {
    const { fields, files } = await utils_api.parser_fields_and_file(req)
    const file_list = files['file'] as formidable.File[]
    const filepath = file_list[0]['filepath']
    const readStream = await fs.readFile(filepath)
    const req_data = new FormData()
    if (fields['prompt']) {
        req_data.append('prompt', fields['prompt'][0])
    }
    const res_data = await fetch(
        utils.config.API_URL + '/api/clip',
        {
            method: 'POST',
            body: req_data,
        }
    )
    const res_data_json = await res_data.json()
    res.status(200).json(res_data_json)
}
