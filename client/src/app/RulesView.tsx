import "./RulesView.css";

export function RulesView() {
  return (
    <div className="rules-root">
      <div className="rules-card">
        <div className="rules-header">
          <a className="rules-back" href="#/">
            Back to Home
          </a>
          <div className="rules-title">Fish Online Rules</div>
          <div className="rules-subtitle">Quick reference for lobby setup and gameplay.</div>
        </div>

        <section className="rules-section">
          <h2>Setup</h2>
          <ul>
            <li>6 seats total, split into Team Alpha and Team Beta (max 3 each).</li>
            <li>Deck: 54 cards (standard 52 + JOKER1 + JOKER2).</li>
            <li>Deal: 9 cards to each seat; there is no draw pile after dealing.</li>
            <li>
              9 claimable sets: LOW/HIGH for each suit (C, D, H, S) + the Specials set (all four 8s + both jokers).
            </li>
            <li>
              Low sets: 2–7 of a suit. High sets: 9–A of a suit. Specials: 8C, 8D, 8H, 8S, JOKER1, JOKER2.
            </li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Lobby & Teams</h2>
          <ul>
            <li>Pick Team Alpha or Team Beta; you can unassign and switch in the lobby.</li>
            <li>Teams are capped at 3 players each; a full team cannot be joined.</li>
            <li>The host can randomize teams and add bots (single seat or fill all empty seats).</li>
            <li>The host can tune bot speed and bot forgetfulness in the lobby settings.</li>
            <li>Lobby bots are placeholders; a joining human can replace a bot seat.</li>
            <li>The game starts only when all 6 seats are filled and all humans are team-assigned.</li>
            <li>If the host leaves, host status transfers to a random human in the room.</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Turn & Asking</h2>
          <ul>
            <li>A random seat starts as the asker.</li>
            <li>You may ask only opposing-team players and only if they have cards.</li>
            <li>You must hold at least one card in the same set and not already have the card you ask for.</li>
            <li>Hit: you take the card and keep asking. Miss: the target becomes the asker.</li>
            <li>You cannot ask a player you are marked disjoint with.</li>
            <li>
              If the current asker has no cards after a claim or disjoint, the turn passes to the next teammate with
              cards (seat order).
            </li>
            <li>
              If the current asker has cards but no legal asks (all opponents are disjoint or out of cards), the turn
              passes to the next teammate with cards (seat order).
            </li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Disjoint</h2>
          <ul>
            <li>At any time during PLAYING, any player may call disjoint on an opposing seat.</li>
            <li>Caller and target must be on opposing teams and not already disjoint.</li>
            <li>
              If incorrect, any overlapping half-suits are immediately captured for the target’s team (cards removed).
            </li>
            <li>After a disjoint call, the pair becomes disjoint and cannot ask each other again.</li>
            <li>Disjoint calls do not change turn order.</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Claims</h2>
          <ul>
            <li>Anyone may claim at any time during PLAYING.</li>
            <li>Claims must assign all 6 cards in the set to teammate seats.</li>
            <li>Correct: set awarded to claimant team. Incorrect: set awarded to opposing team.</li>
            <li>Claimed cards are removed from hands. Claims do not change whose turn it is.</li>
            <li>
              A correct claim requires both: all 6 cards are on your team, and every assigned seat matches the true
              holder.
            </li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>End of Game</h2>
          <ul>
            <li>The game ends after all 9 sets are captured.</li>
            <li>The team with more captured sets wins.</li>
            <li>After FINISHED, the host can return the room to the lobby.</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Chat</h2>
          <ul>
            <li>Chat is available in all phases, including during play.</li>
            <li>Messages are limited to 150 characters.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
