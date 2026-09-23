const express = require("express");
const axios = require("axios");
const db = require("./pedidos_db");

const app = express();

const PRODUTOS_URL =
    process.env.PRODUTOS_URL || "http://localhost:3001";
const CLIENTES_URL = process.env.CLIENTES_URL || "http://localhost:3003";

app.use(express.json());

const pedidos = [];


app.get("/pedidos", async (req, res) => {
    try {
        const resultado = await db.query(
            "SELECT * FROM pedidos ORDER BY id"
        );

        res.json(resultado.rows);
    } catch (erro) {
        res.status(500).json({
            erro: "Erro ao buscar pedidos"
        });
    }
});


app.post("/pedidos", async (req, res) => {
    const { produtoId, quantidade, clienteId } = req.body;

    if (!produtoId || !quantidade || quantidade <= 0 || !clienteId) {
        return res.status(400).json({
            erro: "produtoId, quantidade e clienteId são obrigatórios"
        });
    }

    try {
        const resposta = await axios.get(
            `${PRODUTOS_URL}/produtos/${produtoId}`,
            {
                timeout: 3000
            }
        );
        const cliente = await axios.get(
            `${CLIENTES_URL}/clientes/${clienteId}`,
            {
                timeout: 3000
            }
        );
        if (!cliente.data) {
            return res.status(400).json({
                erro: "Cliente não encontrado"
            });
        }

        const produto = resposta.data;
        const total = produto.preco * quantidade;

        const resultado = await db.query(
            `INSERT INTO pedidos (
        cliente,
        produto,
        quantidade,
        total
      )
        VALUES ($1, $2, $3, $4)
      RETURNING *`,
            [
                cliente.data,
                produto,
                quantidade,
                total
            ]
        );

        res.status(201).json(resultado.rows[0]);
    } catch (erro) {
        if (erro.response?.status === 404) {
            return res.status(400).json({
                erro: "Produto não encontrado"
            });
        }

        if (erro.code === "ECONNREFUSED" || erro.code === "ECONNABORTED") {
            return res.status(503).json({
                erro: "Serviço de Produtos indisponível"
            });
        }

        return res.status(500).json({
            erro: "Erro ao criar pedido"
        });
    }
});



app.get("/pedidos/:id", async (req, res) => {
    try {
        const resultado = await db.query(
            "SELECT * FROM pedidos WHERE id = $1",
            [req.params.id]
        );

        const pedido = resultado.rows[0];

        if (!pedido) {
            return res.status(404).json({
                erro: "Pedido não encontrado"
            });
        }

        res.json(pedido);
    } catch (erro) {
        res.status(500).json({
            erro: "Erro ao buscar pedido"
        });
    }
});

app.use(express.json());

async function criarTabela() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        cliente JSONB NOT NULL,
        produto JSONB NOT NULL,
        quantidade INTEGER NOT NULL,
        total NUMERIC(10, 2) NOT NULL
        )
    `);

    console.log("Tabela de pedidos pronta");
}

criarTabela();

app.listen(3002, () => {
    console.log("Pedidos rodando na porta 3002");
});