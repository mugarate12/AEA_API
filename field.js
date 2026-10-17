import { sql } from './db.js';

export class Field {
    async addField(docId, email, x, y, page = 1) {
        try {
            const existingField = await sql`SELECT * FROM signfield WHERE document_id = ${docId} AND signeremail = ${email} `;

            if (existingField.length > 0) {
                await sql`UPDATE signfield SET x = ${x}, y = ${y}, page = ${page} WHERE document_id = ${docId} AND signeremail = ${email}`;
            } else {
                await sql`INSERT INTO signfield (document_id, signeremail, x, y, page) VALUES (${docId}, ${email}, ${x}, ${y}, ${page})`;
            }

            return { status: 200, message: "Campo adicionado com sucesso" }

        } catch (err) {
            console.error(err);
            return { status: 400, message: "Não foi possivel adicionar o campo" }
        }
    }

    async getField(docId) {
        return await sql`SELECT x, y, page FROM signfield WHERE document_id = ${docId}`
    }


}
