const Fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Create a Fastify instance
const app = Fastify();

// Enable CORS for all routes
app.register(fastifyCors);

// Book CRUD operations and Lending records management

// Create a Book
app.post("/books", async (req, res) => {
  const { title, author, ISBN, quantity, category } = req.body;
  const book = await prisma.book.create({
    data: {
      title,
      author,
      ISBN,
      quantity,
      category,
    },
  });
  res.code(201).send(book);
});

// Get all Books
app.get("/books", async (req, res) => {
  const books = await prisma.book.findMany();
  res.send(books);
});

// Get a Book by ID
app.get("/books/:id", async (req, res) => {
  const { id } = req.params;
  const book = await prisma.book.findUnique({
    where: { id: parseInt(id) },
  });
  if (!book) {
    return res.code(404).send({ message: "Book not found" });
  }
  res.send(book);
});

// Update Book Details
app.put("/books/:id", async (req, res) => {
  const { id } = req.params;
  const { title, author, ISBN, quantity, category } = req.body;
  const updatedBook = await prisma.book.update({
    where: { id: parseInt(id) },
    data: {
      title,
      author,
      ISBN,
      quantity,
      category,
    },
  });
  res.send(updatedBook);
});

// Delete a Book
app.delete("/books/:id", async (req, res) => {
  const { id } = req.params;
  const deletedBook = await prisma.book.delete({
    where: { id: parseInt(id) },
  });
  res.send(deletedBook);
});

// Lending Operations

// Record a Lending transaction
app.post("/lendings", async (req, res) => {
  const { bookId, borrower } = req.body;
  const lending = await prisma.lending.create({
    data: {
      bookId,
      borrower,
    },
  });
  res.code(201).send(lending);
});

// Get all Lending records
app.get("/lendings", async (req, res) => {
  const lendings = await prisma.lending.findMany({
    include: {
      book: true,
    },
  });
  res.send(lendings);
});

// Get Lending records by book ID
app.get("/lendings/book/:bookId", async (req, res) => {
  const { bookId } = req.params;
  const lendings = await prisma.lending.findMany({
    where: { bookId: parseInt(bookId) },
    include: {
      book: true,
    },
  });
  res.send(lendings);
});

// Analytics Endpoint
app.get("/analytics", async (req, res) => {
  const bookLendings = await prisma.book.findMany({
    include: {
      lendings: true,
    },
  });
  const analytics = bookLendings.map((book) => ({
    title: book.title,
    totalLent: book.lendings.length,
    remaining: book.quantity - book.lendings.length,
  }));
  res.send(analytics);
});

const start = async () => {
  app.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
};

start();
