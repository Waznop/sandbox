import './style.css';
import { punJokes, fetchApiJoke, PunJoke } from './jokes';

function getRandomJoke(): PunJoke {
  return punJokes[Math.floor(Math.random() * punJokes.length)];
}

async function getJoke(): Promise<PunJoke> {
  const apiJoke = await fetchApiJoke();
  if (apiJoke) return apiJoke;
  return getRandomJoke();
}

let jokeCount = Math.floor(Math.random() * 9000) + 1000;

function displayJoke(joke: PunJoke) {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div class="card">
      <div class="header">
        <h1>🎪 PunVault</h1>
        <p class="subtitle">Terrible puns, delivered fresh</p>
      </div>
      <div class="joke">
        ${joke.setup ? `<p class="setup">${joke.setup}</p>` : ''}
        <p class="punchline">${joke.punchline}</p>
      </div>
      <button id="next-btn">Another One 😄</button>
      <p class="counter">Joke #${jokeCount}</p>
    </div>
  `;

  document.getElementById('next-btn')!.addEventListener('click', async () => {
    const next = await getJoke();
    jokeCount++;
    const jokeEl = app.querySelector<HTMLDivElement>('.joke')!;
    const counterEl = app.querySelector<HTMLElement>('.counter')!;
    jokeEl.style.opacity = '0';
    setTimeout(() => {
      jokeEl.innerHTML = `
        ${next.setup ? `<p class="setup">${next.setup}</p>` : ''}
        <p class="punchline">${next.punchline}</p>
      `;
      counterEl.textContent = `Joke #${jokeCount}`;
      jokeEl.style.opacity = '1';
    }, 200);
  });
}

// Load initial joke
getJoke().then(displayJoke).catch(() => displayJoke(getRandomJoke()));
