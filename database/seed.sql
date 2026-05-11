\c restaurante_db;

-- Categorías
INSERT INTO categorias (nombre, descripcion, icono, orden) VALUES
('Entradas',         'Platos para comenzar',       '🥗', 1),
('Platos Principales','Nuestros platos estrella',  '🍖', 2),
('Pizzas',           'Pizzas artesanales',          '🍕', 3),
('Bebidas',          'Refrescos, jugos y más',      '🥤', 4),
('Postres',          'Dulces para terminar',        '🍰', 5);

-- Productos
INSERT INTO productos (categoria_id, nombre, descripcion, precio) VALUES
(1, 'Ensalada César',    'Lechuga romana, crutones, queso parmesano y aderezo césar', 8.50),
(1, 'Sopa del día',      'Sopa casera preparada con ingredientes frescos',             6.00),
(1, 'Alitas BBQ',        '8 alitas con salsa BBQ ahumada y dip de queso azul',        12.00),
(2, 'Pollo a la Plancha','Pechuga de pollo a la plancha con vegetales salteados',     14.50),
(2, 'Pasta Carbonara',   'Spaghetti con salsa carbonara, tocino y queso parmesano',   13.00),
(2, 'Filete de Res',     'Filete 250g al punto con puré de papas y ensalada',         22.00),
(2, 'Hamburguesa Clásica','Carne 180g, lechuga, tomate, cebolla, papas fritas',       11.50),
(3, 'Pizza Margherita',  'Salsa de tomate, mozzarella y albahaca fresca',             14.00),
(3, 'Pizza Pepperoni',   'Salsa de tomate, mozzarella y pepperoni',                   16.00),
(3, 'Pizza 4 Quesos',    'Mozzarella, gouda, parmesano y queso azul',                 17.50),
(4, 'Refresco',          'Cola, naranja o limón - 500ml',                              2.50),
(4, 'Jugo Natural',      'Naranja, mango, piña o guayaba - 400ml',                    3.50),
(4, 'Agua Mineral',      'Con o sin gas - 500ml',                                      2.00),
(4, 'Café Americano',    'Café negro preparado al momento',                            3.00),
(5, 'Brownie con Helado','Brownie de chocolate tibio con helado de vainilla',          7.00),
(5, 'Flan de Caramelo',  'Flan casero con salsa de caramelo',                          5.50),
(5, 'Helado',            'Copa de helado 2 bolas a elegir',                            4.50);
