import { app, prisma } from "./app";

app.listen(3000, () => 'server running on port 3000');

prisma.$disconnect();
