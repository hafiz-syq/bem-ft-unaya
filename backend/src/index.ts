import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 BEM-FT UNAYA API Server Started`);
  console.log(`🌐 URL   : http://localhost:${PORT}`);
  console.log(`🔧 ENV   : ${process.env.NODE_ENV}`);
  console.log(`========================================\n`);
});