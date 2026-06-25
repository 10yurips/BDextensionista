const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',         // seu usuário MySQL
  password: '',         // sua senha MySQL
  database: 'doceria',
  waitForConnections: true,
  connectionLimit: 10,
});

// ── ITENS (doces) ─────────────────────────────────────────────

// Listar todos os doces (sem pedido)
app.get('/itens', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM ITEM WHERE id_pedido IS NULL');
  res.json(rows);
});

// Adicionar doce
app.post('/itens', async (req, res) => {
  const { nome, preco, qtd_estoque, data_validade } = req.body;
  const [result] = await pool.query(
    'INSERT INTO ITEM (nome, preco, qtd_estoque, data_validade) VALUES (?, ?, ?, ?)',
    [nome, preco, qtd_estoque || 0, data_validade || null]
  );
  res.json({ id: result.insertId, nome, preco, qtd_estoque, data_validade });
});

// Remover doce
app.delete('/itens/:id', async (req, res) => {
  await pool.query('DELETE FROM ITEM WHERE id = ? AND id_pedido IS NULL', [req.params.id]);
  res.json({ ok: true });
});

// Atualizar quantidade em estoque
app.patch('/itens/:id/estoque', async (req, res) => {
  const { quantidade } = req.body; // positivo = adicionar, negativo = remover
  const [rows] = await pool.query('SELECT qtd_estoque FROM ITEM WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ erro: 'Item não encontrado' });
  const nova = rows[0].qtd_estoque + quantidade;
  if (nova < 0) return res.status(400).json({ erro: 'Estoque insuficiente' });
  await pool.query('UPDATE ITEM SET qtd_estoque = ? WHERE id = ?', [nova, req.params.id]);
  res.json({ qtd_estoque: nova });
});

// ── PEDIDOS ───────────────────────────────────────────────────

// Listar pedidos (com vendedor)
app.get('/pedidos', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*, vp.cpf_vendedor, v.nome AS nome_vendedor
    FROM PEDIDO p
    LEFT JOIN VENDEDOR_PEDIDO vp ON p.id = vp.id_pedido
    LEFT JOIN VENDEDOR v ON vp.cpf_vendedor = v.cpf
    ORDER BY p.id DESC
  `);
  res.json(rows);
});

// Buscar itens de um pedido
app.get('/pedidos/:id/itens', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM ITEM WHERE id_pedido = ?', [req.params.id]);
  res.json(rows);
});

// Criar pedido
app.post('/pedidos', async (req, res) => {
  const { nome_cliente, contato_cliente, cpf_vendedor, itens } = req.body;
  // itens = [{ id_item, qtd }]

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verifica estoque e calcula total
    let total = 0;
    for (const it of itens) {
      const [[item]] = await conn.query('SELECT * FROM ITEM WHERE id = ?', [it.id_item]);
      if (!item) throw new Error(`Item ${it.id_item} não encontrado`);
      if (item.qtd_estoque < it.qtd) throw new Error(`Estoque insuficiente para ${item.nome}`);
      total += item.preco * it.qtd;
    }

    // Cria pedido
    const [result] = await conn.query(
      'INSERT INTO PEDIDO (nome_cliente, contato_cliente, valorTotal) VALUES (?, ?, ?)',
      [nome_cliente, contato_cliente, total]
    );
    const id_pedido = result.insertId;

    // Vincula vendedor
    await conn.query(
      'INSERT INTO VENDEDOR_PEDIDO (cpf_vendedor, id_pedido) VALUES (?, ?)',
      [cpf_vendedor, id_pedido]
    );

    // Registra itens no pedido e desconta estoque
    for (const it of itens) {
      const [[item]] = await conn.query('SELECT * FROM ITEM WHERE id = ?', [it.id_item]);
      // Insere novo registro de item no pedido
      await conn.query(
        'INSERT INTO ITEM (nome, preco, qtd_estoque, data_validade, id_pedido, qtdItens) VALUES (?, ?, ?, ?, ?, ?)',
        [item.nome, item.preco, 0, item.data_validade, id_pedido, it.qtd]
      );
      // Desconta estoque do item original
      await conn.query(
        'UPDATE ITEM SET qtd_estoque = qtd_estoque - ? WHERE id = ?',
        [it.qtd, it.id_item]
      );
    }

    await conn.commit();
    res.json({ id_pedido, total });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ erro: e.message });
  } finally {
    conn.release();
  }
});

// Atualizar status do pedido
app.patch('/pedidos/:id/status', async (req, res) => {
  const { status } = req.body;
  await pool.query('UPDATE PEDIDO SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ ok: true });
});

// Remover pedido (devolve estoque)
app.delete('/pedidos/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Itens do pedido
    const [itens] = await conn.query('SELECT * FROM ITEM WHERE id_pedido = ?', [req.params.id]);
    for (const it of itens) {
      // Devolve ao item de estoque pelo nome
      await conn.query(
        'UPDATE ITEM SET qtd_estoque = qtd_estoque + ? WHERE nome = ? AND id_pedido IS NULL',
        [it.qtdItens, it.nome]
      );
    }
    await conn.query('DELETE FROM ITEM WHERE id_pedido = ?', [req.params.id]);
    await conn.query('DELETE FROM VENDEDOR_PEDIDO WHERE id_pedido = ?', [req.params.id]);
    await conn.query('DELETE FROM PEDIDO WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ erro: e.message });
  } finally {
    conn.release();
  }
});

// ── VENDEDORES ────────────────────────────────────────────────

app.get('/vendedores', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM VENDEDOR');
  res.json(rows);
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));