const Fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

// Create a Fastify instance
const app = Fastify();
const PORT = 3030;

// Enable CORS for all routes
app.register(fastifyCors);

// Admin Registration
app.post("/users", async (req, res) => {
  const { username, email, password } = req.body;
  const userExists = await prisma.user.findUnique({
    where: { email },
  });
  if (userExists) {
    return res.code(400).send({
      success: false,
      message: "User already exists. Registration is failed!",
    });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: username,
      email: email,
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  res.code(201).send({ success: true, message: "User is created" });
});

// Member Registration
app.post("/members", async (req, res) => {
  const { name, email, status } = req.body;
  const userExists = await prisma.user.findUnique({
    where: { email },
  });
  if (userExists) {
    const memberExists = await prisma.member.findUnique({
      where: {
        userId: userExists.id,
        status: {
          in: ["ACTIVE", "DRAFT"],
        },
      },
    });
    if (memberExists) {
      return res.code(400).send({
        success: false,
        message: "Member already exists. Registration is failed!",
      });
    }
  }
  const hashedPassword = await bcrypt.hash(email, 10);
  const user = await prisma.user.create({
    data: {
      name: name,
      email: email,
      password: hashedPassword,
      role: "MEMBER",
    },
  });

  await prisma.member.create({
    data: {
      userId: user.id,
      status: status,
    },
  });

  res.code(201).send({ success: true, message: "Member is registered" });
});

// List of Members
app.get("/members", async (req, res) => {
  const members = await prisma.member.findMany({
    where: {
      status: {
        in: ["ACTIVE", "DRAFT"],
      },
    },
    select: {
      id: true,
      status: true,
      joinedDate: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });
  res.code(201).send({ success: true, members: members });
});

// Update Member
app.put("/members/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, status } = req.body;
  const memberData = await prisma.member.findUnique({
    where: { id: parseInt(id) },
    include: {
      user: true,
    },
  });
  if (memberData.user.email != email) {
    const userExists = await prisma.user.findUnique({
      where: { email },
    });
    if (userExists) {
      const memberExists = await prisma.member.findUnique({
        where: {
          userId: userExists.id,
          status: {
            in: ["ACTIVE", "DRAFT"],
          },
          NOT: {
            id: memberData.id,
          },
        },
      });
      if (memberExists) {
        return res.code(400).send({
          success: false,
          message: `Email: ${email} already exists. Updating member is failed!`,
        });
      }
    }
  }
  await prisma.member.update({
    where: { id: parseInt(id) },
    data: {
      status: status,
    },
  });
  await prisma.user.update({
    where: {
      id: memberData.userId,
    },
    data: {
      name: name,
      email: email,
    },
  });
  res.code(201).send({ success: true });
});

// Delete a Member
app.delete("/members/:id", async (req, res) => {
  const { id } = req.params;
  const member = await prisma.member.findUnique({
    where: { id: parseInt(id) },
  });
  if (!member) {
    return res.code(400).send({ success: false, message: "Member not found!" });
  }

  await prisma.member.delete({
    where: { id: parseInt(id) },
  });

  await prisma.user.delete({
    where: { id: member.userId },
  });
  res.code(201).send({ success: true });
});

// Admin Login
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: { email: email },
  });
  if (!user) {
    return res.code(400).send({
      success: false,
      message: "Invalid login credentials!",
    });
  }
  if (user.role != "ADMIN")
    return res.code(401).send({ success: false, message: "Unathorized user!" });

  const matchedPassword = await bcrypt.compare(password, user.password);
  if (!matchedPassword) {
    return res.code(400).send({
      success: false,
      message: "Invalid login credentials!",
    });
  }
  // Generate JWT
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.code(201).send({ success: true, token: token });
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.code(403).send({ message: "Token is required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.code(403).send({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Book CRUD operations and Lending records management

// Create a Category
app.post("/categories", async (req, res) => {
  const { name } = req.body;
  const category = await prisma.category.create({
    data: {
      name,
    },
  });
  res.code(201).send({ success: true, category: category });
});

// List of Categories
app.get("/categories", async (req, res) => {
  const categories = await prisma.category.findMany({
    where: {
      status: "ACTIVE",
    },
  });
  res.code(201).send({ success: true, categories: categories });
});

// Update Category
app.put("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const updatedCategory = await prisma.category.update({
    where: { id: parseInt(id) },
    data: {
      name: name,
    },
  });
  res.code(201).send({ success: true, category: updatedCategory });
});

// Delete a Book
app.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.category.delete({
    where: { id: parseInt(id) },
  });
  res.code(201).send({ success: true });
});

// Create a Book
app.post("/books", async (req, res) => {
  const { title, author, ISBN, quantity, categoryId } = req.body;
  const book = await prisma.book.create({
    data: {
      title,
      author,
      ISBN,
      quantity,
      categoryId,
    },
  });
  res.code(201).send({ success: true, book: book });
});

// Get all Books
app.get("/books", async (req, res) => {
  const books = await prisma.book.findMany({
    select: {
      id: true,
      title: true,
      author: true,
      ISBN: true,
      quantity: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      id: "desc",
    },
  });
  res.code(201).send({ success: true, books: books });
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
  res.code(201).send({ success: true, book: book });
});

// Update Book Details
app.put("/books/:id", async (req, res) => {
  const { id } = req.params;
  const { title, author, ISBN, quantity, categoryId } = req.body;
  const updatedBook = await prisma.book.update({
    where: { id: parseInt(id) },
    data: {
      title,
      author,
      ISBN,
      quantity,
      categoryId,
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
  res.code(201).send({ success: true });
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
  res.code(201).send({ success: true, lending: lending });
});

// Get all Lending records
app.get("/lendings", async (req, res) => {
  const lendings = await prisma.lending.findMany({
    include: {
      book: true,
    },
  });
  res.code(201).send({ success: true, lendings: lendings });
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
  res.code(201).send({ success: true, lendings: lendings });
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
  res.code(201).send({ success: true, analytics: analytics });
});

const start = async () => {
  app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
};

start();
