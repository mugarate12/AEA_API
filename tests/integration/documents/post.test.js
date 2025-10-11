const dotenv = require('dotenv');

const { uploadDocument, addSigner, addSignPositionToDocument, signDocument } = require('./../../routes/documents.routes');

dotenv.config({
    path: process.env.NODE_ENV === 'production' ? '.env' : '.env.development',
});

test('POST to /v1/documents should upload file and return 200 and documentId', async () => {
    const response = await uploadDocument();
    const body = response.data;

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('message');
    expect(body.message).toHaveProperty('documentId');
    expect(body.message.documentId).toBeDefined();
    expect(body.message.status).toBe('uploaded');
});

test('POST to /v1/documents/:documentId/signers (to add signer) should return 200', async () => {
    const addDocumentResponse = await uploadDocument();
    const documentId = addDocumentResponse.data.message.documentId;
    const payload = {
        name: 'John Doe',
        email: 'john_doe@mail.com',
        order: 1,
    };

    const response = await addSigner(documentId, payload);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
});

test('POST to /v1/documents/:documentId/signature-fields (to add field to receive sign) should return 200', async () => {
    const addDocumentResponse = await uploadDocument();
    const documentId = addDocumentResponse.data.message.documentId;
    const addSignerPayload = {
        name: 'John Doe',
        email: 'john_doe@mail.com',
        order: 1,
    };
    await addSigner(documentId, addSignerPayload);
    const payload = {
        x: 500,
        y: 500,
        email: addSignerPayload.email,
    };

    const response = await addSignPositionToDocument(documentId, payload);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
    expect(typeof response.data.message === 'string').toBe(true);
    expect(response.data.message.length).toBeGreaterThan(0);
});

test('POST to /v1/documents/:documentId/sign (to sign document that received field to sign) should return 200', async () => {
    const addDocumentResponse = await uploadDocument();
    const documentId = addDocumentResponse.data.message.documentId;
    const addSignerPayload = {
        name: 'John Doe',
        email: 'john_doe@mail.com',
        order: 1,
    };
    await addSigner(documentId, addSignerPayload);
    const addSignPositionToDocumentPayload = {
        x: 500,
        y: 500,
        email: addSignerPayload.email,
    };
    await addSignPositionToDocument(documentId, addSignPositionToDocumentPayload);
    const payload = {
        name: addSignerPayload.name,
        email: addSignerPayload.email,
    };

    const response = await signDocument(documentId, payload);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
    expect(typeof response.data.message === 'string').toBe(true);
    expect(response.data.message.length).toBeGreaterThan(0);
});

test('POST to /v1/documents/:documentId/sign (to sign document that received field to sign) without add position to document route should return 500', async () => {
    const addDocumentResponse = await uploadDocument();
    const documentId = addDocumentResponse.data.message.documentId;
    const addSignerPayload = {
        name: 'John Doe',
        email: 'john_doe@mail.com',
        order: 1,
    };
    await addSigner(documentId, addSignerPayload);
    const payload = {
        name: addSignerPayload.name,
        email: addSignerPayload.email,
    };

    try {
        await signDocument(documentId, payload);
        // If no error is thrown, fail the test
        throw new Error('Expected signDocument to throw an error, but it did not.');
    } catch (error) {
        expect(error).toBeDefined();

        if (error.response) {
            expect(error.response.status).toBe(500);
        }
    }
});
