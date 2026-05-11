require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const menuRoutes    = require('./routes/menu');
const orderRoutes   = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const authRoutes    = require('./routes/auth');
const pushRoutes    = require('./routes/push');
const { verificarToken, soloAdmin } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] },
});

app.set('io', io);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/uploads/comprobantes-generados', express.static(path.join(__dirname, '../../uploads/comprobantes-generados')));

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);

// Pedidos: POST público (clientes), GET y PATCH requieren token (admin)
app.use('/api/pedidos', orderRoutes);

app.use('/api/pagos', verificarToken, soloAdmin, paymentRoutes);
app.use('/api/push', pushRoutes);

// Rutas de las vistas (menú público, admin/cocina protegidos por JS)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/login.html')));
app.get('/cocina', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/kitchen.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/admin.html')));
app.get('/tracking', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/tracking.html')));

// Socket.io: salas por rol
io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);

  socket.on('unirse', (sala) => {
    socket.join(sala);
    console.log(`Socket ${socket.id} unido a sala: ${sala}`);
  });

  // Cliente sigue su pedido en tiempo real
  socket.on('seguir_pedido', (numeroPedido) => {
    socket.join(`pedido_${numeroPedido}`);
    console.log(`Socket ${socket.id} siguiendo pedido: ${numeroPedido}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   📋 Menú:    http://localhost:${PORT}/`);
  console.log(`   🍳 Cocina:  http://localhost:${PORT}/cocina`);
  console.log(`   ⚙️  Admin:   http://localhost:${PORT}/admin\n`);
});
