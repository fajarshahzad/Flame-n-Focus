/* Public landing page. Layout follows the Home frame of the FoodZero / Flame & Fuel Figma design.
   Depends on app.js (esc, $, $$ helpers). */
"use strict";

const LP_DISHES = [
  ["Zinger Burger", "Crispy spiced chicken, lettuce and house sauce on a toasted bun.", 750],
  ["Grilled Chicken Salad Bowl", "Grilled chicken, greens and a light citrus dressing. 380 kcal.", 820],
  ["Veggie Wrap", "Fresh vegetables, hummus and herbs in a warm wrap.", 560],
  ["Paneer Tikka Roll", "Smoky paneer tikka with mint chutney and crunchy onions.", 620],
  ["Beef Steak Sandwich", "Seared beef steak, caramelised onions and mustard.", 990],
  ["Chicken Tikka Platter", "Tandoor-style chicken tikka with raita and salad.", 1150],
];

const LP_ICONS = {
  leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
};
const lpIcon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${LP_ICONS[n]}"/></svg>`;

function renderLanding() {
  const dishes = LP_DISHES.map(([n, d, p]) => `
    <div class="lp-dish"><div class="lp-dish-top"><span class="lp-price">Rs ${p}</span></div>
      <h3>${esc(n)}</h3><p>${esc(d)}</p></div>`).join("");
  $("#app").innerHTML = `
  <div class="lp">
    <section class="lp-green lp-hero">
      <div class="lp-wrap">
        <header class="lp-nav">
          <a class="lp-logo" href="#/">FLAME N FOCUS</a>
          <div class="lp-nav-r">
            <a class="lp-link" href="#/login">Sign in</a>
            <a class="lp-btn lp-btn-line" href="#/signup">Get started</a>
          </div>
        </header>
        <div class="lp-hero-body">
          <h1>Healthy Eating is important part of lifestyle</h1>
          <p class="lp-lead">Connect yourself with food and fuel at the same time.</p>
          <div class="lp-actions">
            <a class="lp-btn lp-btn-olive" href="#/signup">Explore Food</a>
            <a class="lp-btn lp-btn-line" href="#/signup">Build My Meal Plan</a>
          </div>
          <div class="lp-scroll" aria-hidden="true"><span>Scroll</span><i></i></div>
          <img class="lp-hero-photo" src="/static/img/steak.jpg" alt="Seared steak with onions and rosemary">
          <div class="lp-spices" aria-hidden="true"><img src="/static/img/spices1.png" alt=""><img src="/static/img/spices2.png" alt=""><img src="/static/img/spices3.png" alt=""></div>
        </div>
        <div class="lp-pair">
          <figure class="lp-soup"><img src="/static/img/soup.jpg" alt="Creamy clam chowder"><figcaption>Start to plan<br>your diet today</figcaption></figure>
          <div class="lp-mills"><p>Fresh ingredients, bold flavours, and a passion for good food in every bite.</p><img src="/static/img/mills.jpg" alt="Salt and pepper mills"></div>
        </div>
      </div>
    </section>

    <section class="lp-white" id="lp-menu">
      <div class="lp-wrap">
        <h2 class="lp-h2">Our Menu</h2><p class="lp-eyebrow">Explore the menu</p>
        <div class="lp-dishes">${dishes}</div>
        <div class="lp-center"><a class="lp-btn lp-btn-olive" href="#/signup">See the full menu</a></div>
      </div>
    </section>

    <section class="lp-sage lp-ai" id="lp-ai">
      <div class="lp-wrap lp-ai-in">
        <img src="/static/img/chef.jpg" alt="Chef plating a dish">
        <div><h2 class="lp-h2">Your AI nutrition assistant</h2>
          <p>Snap a photo of your meal, say what you ate, or type it. We estimate calories and macros, flag your allergies and suggest lighter swaps. Ask follow-up questions in English, Urdu or Roman Urdu.</p>
          <a class="lp-btn lp-btn-olive" href="#/signup">Try the assistant</a></div>
      </div>
    </section>

    <section class="lp-white">
      <div class="lp-wrap lp-feats">
        <div><span class="lp-ico">${lpIcon("leaf")}</span><h3>Personalised plans</h3><p>Daily or weekly meal plans built around your goal, diet and budget, with prices on every meal.</p></div>
        <div><span class="lp-ico">${lpIcon("shield")}</span><h3>Allergy aware</h3><p>Allergies, dislikes and declared conditions are applied to every suggestion, never shown to others.</p></div>
        <div><span class="lp-ico">${lpIcon("clock")}</span><h3>Eat together, on time</h3><p>Team lunches with one combined order, a bill split and a break timeline, plus focus and hydration reminders.</p></div>
      </div>
    </section>

    <section class="lp-white lp-cards">
      <div class="lp-wrap">
        <div class="lp-grid2">
          <article><div class="lp-card-img"><img src="/static/img/pear.jpg" alt="Plated vegetables"><span class="lp-tag">Featured</span></div>
            <h3>Fruit and vegetables and protection against diseases</h3><a class="lp-more" href="#/signup">Read more →</a></article>
          <article><div class="lp-card-img"><img src="/static/img/asparagus.jpg" alt="Asparagus"><span class="lp-tag">High protein</span></div>
            <h3>Asparagus spring salad with rocket, goat's cheese</h3><a class="lp-more" href="#/signup">Read more →</a></article>
        </div>
      </div>
    </section>

    <section class="lp-sage lp-plan" id="lp-plan">
      <div class="lp-wrap">
        <h2 class="lp-h2 lp-center">Build My Meal Plan</h2><p class="lp-eyebrow lp-center">Start in under a minute</p>
        <div class="lp-form">
          <label>Goal<select id="lpg"><option>Maintain weight</option><option>Lose weight</option><option>Gain weight</option><option>Build muscle</option></select></label>
          <label>Days<select id="lpd"><option>1 day</option><option>3 days</option><option>7 days</option></select></label>
          <label>Budget (Rs)<input id="lpb" type="number" min="0" placeholder="e.g. 3000"></label>
        </div>
        <div class="lp-center"><a class="lp-btn lp-btn-olive" href="#/signup">Start planning</a></div>
      </div>
    </section>

    <section class="lp-white lp-cats">
      <div class="lp-wrap">
        <h2 class="lp-h2 lp-center">Calories Energy Balance</h2><p class="lp-eyebrow lp-center">Burn your calories with us</p>
        <div class="lp-grid3">
          <a href="#/signup"><img src="/static/img/pear.jpg" alt=""><span>Breakfast →</span></a>
          <a href="#/signup"><img src="/static/img/plate.jpg" alt=""><span>Lunch →</span></a>
          <a href="#/signup"><img src="/static/img/soup.jpg" alt=""><span>Dinner →</span></a>
        </div>
        <blockquote class="lp-quote"><span aria-hidden="true">“</span>Plan your focus, fuel your passion, and savour every moment.</blockquote>
      </div>
    </section>

    <footer class="lp-green lp-foot">
      <div class="lp-wrap lp-foot-in">
        <div><strong class="lp-foot-logo">FLAME<br>N<br>FOCUS</strong></div>
        <div><h4>Explore</h4><a href="#/login">Sign in</a><a href="#/signup">Create account</a></div>
        <div><h4>Open source</h4><p>Apache-2.0 licensed.</p><a href="https://github.com/fajarshahzad/Flame-n-Focus" target="_blank" rel="noopener">View on GitHub</a></div>
      </div>
      <div class="lp-wrap lp-copy">Built at Hacktoberfest Hack Day Lahore</div>
    </footer>
  </div>`;
}
