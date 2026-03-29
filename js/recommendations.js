// Рекомендації на основі жанрів прочитаних книг
async function getRecommendations() {
  const books = await getAllBooks();
  if (!books.length) return searchBooks('бестселер роман fiction');

  // Збираємо топ-категорії
  const catCount = {};
  books.forEach(b => {
    b.categories?.forEach(c => {
      const cLower = c.toLowerCase();
      catCount[cLower] = (catCount[cLower] || 0) + 1;
    });
  });

  const topCats = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const query = topCats.length
    ? topCats[0]
    : 'bestseller fiction novel thriller';

  const results = await searchBooks(query);
  const myIds = new Set(books.map(b => b.id));
  return results.filter(b => !myIds.has(b.id)).slice(0, 12);
}
