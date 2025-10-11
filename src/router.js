import { Router } from "express";
import express from 'express';               // criar o servidor
import multer from 'multer';
import dotenv from 'dotenv';                 // carregar variaveis de ambiente
import path from 'path';
import fs from 'fs';                    // manipular arquivos
import { verifyToken } from '../tokens.js';  // autenticar o token
import { config } from '../multerConfig.js'; // configurar o multer
import { Doc } from '../doc.js';             // manipular documentos no db
import { Signer } from '../signers.js';      // manipular assinantes no db
import { Field } from '../field.js';         // manipular campos no db

dotenv.config({
    path: process.env.NODE_ENV === 'production' ? '.env' : '.env.development',
})
const router = Router()

const storage = multer(config)
const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true })
router.use('/documents/uploads', express.static(uploadsDir))

// STATUS ROUTES
router.get('/status', async (_, reply) => {
    return reply.status(200).send({ message: "API funcionando" });
});

// GET METHODS -----------------------------------------------
// VISUALIZAR DOC
router.get('/documents/:documentId', async (request, reply) => {
    const id = request.params.documentId
    const doc = new Doc()
    const status = await doc.getDoc(id)
    return reply.status(status.status).send({ message: status.message })
})


// ESCOLHER O CAMPO
router.get('/documents/:documentId/prepare-signature', async (request, reply) => {
    const id = request.params.documentId
    const signer = await new Signer().getSigners(id);

    if (signer.status === 200) {
        const signerEmail = signer.message[0].email;
        const signerName = signer.message[0].name;
        const p = path.resolve('src/index.ejs');
        const token = process.env.TOKEN;

        const doc = new Doc();
        const docDetails = await doc.getDoc(id);

        return reply.render(p, {
            id,
            signerName,
            signerEmail,
            token,
            docLink: typeof docDetails === 'object' ? docDetails.message.links.doc : '',
        });
    }
})

// BAIXAR DOCUMENTO DEPOIS DE PRONTO
router.get('/documents/:documentId/download', verifyToken, async (request, reply) => {
    const id = request.params.documentId
    const doc = new Doc()
    const status = await doc.getDoc(id);

    if (status.message.status === 'completed') {
        reply.download(`uploads/${id}.pdf`, (err) => {
            if (err) {
                return reply.status(500).send({ error: err })
            }
        })
    } else {
        return reply.status(409).send({ message: "Documento não está completo" })
    }
})


//POST METHODS -------------------------------------------------
// ENVIAR ARQUIVOS
router.post('/documents', verifyToken, storage.single('file'), async (request, reply) => {
    const id = String(new Date().getTime());
    const doc = new Doc()
    const result = await doc.addDoc(id, request.file);

    return reply.status(result.status).send({ message: result.message })
})

//ADICIONAR QUEM ASSINARÁ
router.use(express.json())
router.post('/documents/:documentId/signers', verifyToken, async (request, reply) => {
    const { name, email, order } = request.body
    const id = request.params.documentId
    const signer = new Signer()

    const result = await signer.addSigner(id, name, email, order)

    return reply.status(result.status).send({ message: result.message })
})

//ADICIONAR O CAMPO DA ASSINATURA
router.post('/documents/:documentId/signature-fields', verifyToken, async (request, reply) => {
    const { x, y, email } = request.body
    const id = request.params.documentId
    const signer = new Field()
    const result = await signer.addField(id, email, x, y);

    return reply.status(result.status).send({ message: result.message })
})

//ADICIONAR A ASSINATURA
router.post('/documents/:documentId/sign', verifyToken, async (request, reply) => {
    const { name, email, } = request.body
    const id = request.params.documentId
    const signer = new Signer()
    const doc = new Doc()

    try {
        const result = await signer.complete(id);

        if (result.status === 200) {
            await doc.complete(id, name, email)
            return reply.status(result.status).send({ message: result.message })
        } else {
            return reply.status(result.status).send({ message: result.message })
        }
    } catch (error) {
        return reply.status(500).send({
            message: `Erro ao completar a assinatura: ${error.message}! Por favor, tente novamente`
        });
    }
})

// DELETE METHODS ------------------------------------------------
router.delete('/documents/:documentId', verifyToken, async (request, reply) => {
    const id = request.params.documentId
    const doc = new Doc()
    const result = await doc.getDoc(id)
    console.log(result)
    if (result.status === 200) {
        const resultDoc = await doc.deleteDoc(id)
        result.status === 200 ? reply.status(resultDoc.status).send({ message: resultDoc.message })
            : reply.status(resultDoc.status).send({ message: resultDoc.message })
        console.log(resultDoc)
    } else {
        reply.status(result.status).send({ message: result.message })
    }
})


export { router }
