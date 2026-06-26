CREATE DATABASE IF NOT EXISTS doceria;
USE doceria;

CREATE TABLE VENDEDOR (
  cpf VARCHAR(14) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  contato VARCHAR(50)
);

CREATE TABLE PEDIDO (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_cliente VARCHAR(100) NOT NULL,
  contato_cliente VARCHAR(50),
  status ENUM('pendente', 'confirmado', 'entregue', 'cancelado') DEFAULT 'pendente',
  valorTotal DECIMAL(10,2) DEFAULT 0
);

CREATE TABLE ITEM (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  qtd_estoque INT DEFAULT 0,
  data_validade DATE
);

CREATE TABLE VENDEDOR_PEDIDO (
  cpf_vendedor VARCHAR(14),
  id_pedido INT,
  data_registro DATETIME DEFAULT CURRENT_TIMESTAMP, 
  PRIMARY KEY (cpf_vendedor, id_pedido),
  FOREIGN KEY (cpf_vendedor) REFERENCES VENDEDOR(cpf),
  FOREIGN KEY (id_pedido) REFERENCES PEDIDO(id)
);

CREATE TABLE ITEM_PEDIDO (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_item INT NOT NULL,
  qtd INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_pedido) REFERENCES PEDIDO(id),
  FOREIGN KEY (id_item) REFERENCES ITEM(id)
);

-- Vendedor
INSERT INTO VENDEDOR (cpf, nome, contato) VALUES ('000.000.000-00', 'Vendedor Teste', 'teste@email.com');
