import type { NextApiRequest, NextApiResponse } from 'next'
import * as utils from '@/utils';

export const config = {
    api: {
        bodyParser: false,
        responseLimit: false,
    }
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Response>) {
    const reader = await fetch(
        utils.config.API_URL + '/sam_vit.onnx',
        {
            method: 'GET',
        }
    ).then((response) => {
        return response?.body?.getReader();
    })
    while (true) {
        const readed = await reader?.read();
        if (readed?.done) {
            break;
        }
        res.write(readed?.value);
    }
    res.status(200).end();
}
