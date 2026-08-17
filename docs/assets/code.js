// Colour `burxt` and `bmx` code blocks on a Jekyll site.
//
// **Why this exists rather than a Rouge lexer.** Rouge is Jekyll's highlighter and it knows neither
// language, so a ```burxt block ships as plain `<pre><code class="language-burxt">` — while the
// ```js block beside it comes out coloured. Every page that teaches Burxt or BMX has been showing
// its own language as grey text next to somebody else's language in colour.
//
// A Rouge lexer is the "proper" answer and it is written in Ruby, which is not installed on the
// machine these sites are written on — Jekyll only ever runs on the remote. A lexer nobody here can
// run is a lexer nobody here can test, and this project has been bitten by exactly that.
//
// **The decisions here are not invented.** Both languages already have a TextMate grammar, and the
// classes below map onto the scopes those grammars produce — so what an author sees on the site and
// what they see in their editor are the same decision made once. `editors/vscode/test/agrees.mjs`
// checks that claim against the real grammar rather than asserting it.
//
// No dependencies, no build step, ~10 KB. Runs after the DOM is ready, once, and does nothing if
// there is no code on the page.

(() => {
  'use strict';

  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const span = (cls, text) => (cls ? `<span class="t-${cls}">${escapeHtml(text)}</span>` : escapeHtml(text));

  // ---- Burxt -----------------------------------------------------------------------------------
  //
  // Order is the whole correctness story: a comment containing a keyword is a comment, and a string
  // containing `//` is a string. So comments and strings are consumed before anything else looks.

  const BURXT_KEYWORD = /^(?:if|else|while|match|return|for|in|break|continue|let|mutable|function|pure|class|enum|interface|region|use|const|external|public|private|requires|ensures|touches|decreases|allocates|as|impl|self|Ok|Error|Some|None)\b/;
  const BURXT_RESERVED = /^(?:fn|mut|impl|dyn|extern|struct|trait|record)\b/;
  const BURXT_BUILTIN = /^(?:print|print_error|len|byte_at|byte_as_string|push|read_file|to_string|old|divide_floor|divide_toward_zero|remainder|substring|write_file|write_bytes|argument|argument_count|truncate|hash|exit|bit_and|bit_or|bit_xor|bit_not|shift_left|shift_right_zeros|shift_right_sign|c_is_null|c_string_at|c_bytes_at|c_bytes_to|char_at|char_count|from_bytes|to_bytes|html_render|html_text|html_element|html_attr|bmx_parse|bmx_check|bmx_where)\b/;
  const BURXT_TYPE = /^(?:Decimal|Int|String|Bool|Option|Result|Json|Html|CPointer|CInt|CDouble|Handle)\b/;

  function burxt(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
      const rest = src.slice(i);

      // a comment runs to end of line, and nothing inside it is anything else
      if (rest.startsWith('//')) {
        const end = rest.indexOf('\n');
        const text = end < 0 ? rest : rest.slice(0, end);
        out += span('comment', text);
        i += text.length;
        continue;
      }

      // a string, with `{…}` interpolation shown as itself rather than as string
      if (rest[0] === '"') {
        let j = 1;
        while (j < rest.length && rest[j] !== '"') {
          if (rest[j] === '\\') j++;
          j++;
        }
        const text = rest.slice(0, Math.min(j + 1, rest.length));
        out += span('string', text);
        i += text.length;
        continue;
      }

      // a money or percent literal: $19.99, 8.25% — exact, and worth looking exact
      let m = /^(?:\$\d+(?:\.\d+)?|\d+(?:\.\d+)?%)/.exec(rest);
      if (m) { out += span('money', m[0]); i += m[0].length; continue; }

      m = /^\d+(?:\.\d+)?/.exec(rest);
      if (m) { out += span('number', m[0]); i += m[0].length; continue; }

      if (/^[A-Za-z_]/.test(rest)) {
        const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest)[0];
        let cls = null;
        if (BURXT_RESERVED.test(word)) cls = 'invalid';       // spellings that do not compile
        else if (BURXT_KEYWORD.test(word)) cls = 'keyword';
        else if (BURXT_BUILTIN.test(word)) cls = 'builtin';
        else if (BURXT_TYPE.test(word)) cls = 'type';
        else if (/^[A-Z]/.test(word)) cls = 'type';           // a user's class or enum
        else if (/^\s*\(/.test(rest.slice(word.length))) cls = 'call';
        out += span(cls, word);
        i += word.length;
        continue;
      }

      m = /^[{}()[\];,:.<>=+\-*/!&|]+/.exec(rest);
      if (m) { out += span('punct', m[0]); i += m[0].length; continue; }

      out += escapeHtml(rest[0]);
      i += 1;
    }
    return out;
  }

  // ---- BMX -------------------------------------------------------------------------------------
  //
  // Line-oriented, and in the same order the grammar uses: a fenced code block wins over
  // everything, because §5 says its content is never parsed — colouring a `{{` inside one would be
  // a lie the author cannot turn off.

  function bmxInline(line) {
    let out = '';
    let i = 0;
    while (i < line.length) {
      const rest = line.slice(i);

      // an escape, and only the five the format allows
      let m = /^\\[`*[{\\]/.exec(rest);
      if (m) { out += span('escape', m[0]); i += 2; continue; }

      // a code span before a slot: `{{ x }}` inside backticks is text
      m = /^`[^`]*`/.exec(rest);
      if (m) { out += span('raw', m[0]); i += m[0].length; continue; }

      // a slot. The delimiters are BMX's; the expression is the HOST's, so it is coloured as an
      // expression rather than as markup — which is the same split the grammar makes by leaving
      // `meta.slot.expression.bmx` for a host to inject into.
      m = /^\{\{(.*?)\}\}/.exec(rest);
      if (m) {
        out += span('slot-mark', '{{') + span('slot', m[1]) + span('slot-mark', '}}');
        i += m[0].length;
        continue;
      }

      // an inline block — deliberately not a slot, because a slot's value is escaped and this is a
      // call to something the host declared
      m = /^::([A-Za-z][A-Za-z0-9_-]*)\[(.*?)\]::/.exec(rest);
      if (m) {
        out += span('slot-mark', '::') + span('name', m[1]) + span('slot-mark', '[')
             + span('slot', m[2]) + span('slot-mark', ']::');
        i += m[0].length;
        continue;
      }

      // The markers are punctuation and the words are the emphasis — which is what every markdown
      // theme does, and what the grammar says: `punctuation.definition.bold.bmx` sits inside
      // `markup.bold.bmx`. Colouring the asterisks as bold too made them shout.
      m = /^\*\*([^*]+)\*\*/.exec(rest);
      if (m) {
        // The content recurses: the grammar includes `#slot` inside `#strong`, so `**{{ x }}**`
        // has a slot in it. `[^*]+` cannot contain another `*`, so this terminates.
        out += span('punct', '**') + '<span class="t-strong">' + bmxInline(m[1])
             + '</span>' + span('punct', '**');
        i += m[0].length;
        continue;
      }
      m = /^\*([^*]+)\*/.exec(rest);
      if (m) {
        out += span('punct', '*') + '<span class="t-em">' + bmxInline(m[1])
             + '</span>' + span('punct', '*');
        i += m[0].length;
        continue;
      }

      m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
      if (m) {
        out += span('punct', '[') + span('link-text', m[1]) + span('punct', '](')
             + span('link', m[2]) + span('punct', ')');
        i += m[0].length;
        continue;
      }

      out += escapeHtml(rest[0]);
      i += 1;
    }
    return out;
  }

  function bmx(src) {
    const lines = src.split('\n');
    const out = [];
    let fence = null; // the ``` or ~~~ currently open, if any

    for (const line of lines) {
      if (fence !== null) {
        out.push(span('raw', line));
        if (line.trim() === fence) fence = null;
        continue;
      }

      let m = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
      if (m) {
        fence = m[2];
        out.push(m[1] + span('raw', m[2]) + span('info', m[3]));
        continue;
      }

      // a closer: :!name:
      m = /^(\s*)(:!)([A-Za-z][A-Za-z0-9_-]*)(:)([ \t]*)$/.exec(line);
      if (m) {
        out.push(m[1] + span('fence', m[2]) + span('name', m[3]) + span('fence', m[4]) + m[5]);
        continue;
      }

      // an opener: :name: head
      // The whitespace after the marker belongs to neither the name nor the head — the grammar's
      // `[ \t]*` eats it between captures, so a head starting one character early is a real
      // divergence and `agrees.mjs` caught it.
      m = /^(\s*)(:)([A-Za-z][A-Za-z0-9_-]*)(:)([ \t]*)(.*)$/.exec(line);
      if (m) {
        let head = m[6];
        // `.class` and `#id` are the only parts of a head BMX has an opinion about
        head = escapeHtml(head)
          .replace(/(\.)([A-Za-z][A-Za-z0-9_-]*)/g, '<span class="t-class">$1$2</span>')
          .replace(/(#)([A-Za-z][A-Za-z0-9_-]*)/g, '<span class="t-id">$1$2</span>');
        out.push(m[1] + span('fence', m[2]) + span('name', m[3]) + span('fence', m[4])
                 + m[5]
                 + (m[6] ? '<span class="t-head">' + head + '</span>' : ''));
        continue;
      }

      m = /^(\s*)(#{1,6})([ \t]+)(.*)$/.exec(line);
      if (m) {
        // `#inline` runs inside a heading in the grammar, so a slot in a heading is a slot.
        out.push(m[1] + span('punct', m[2]) + m[3]
                 + '<span class="t-heading">' + bmxInline(m[4]) + '</span>');
        continue;
      }

      m = /^(\s*)(>)([ \t]?)(.*)$/.exec(line);
      if (m) {
        out.push(m[1] + span('punct', m[2]) + m[3]
                 + '<span class="t-quote">' + bmxInline(m[4]) + '</span>');
        continue;
      }

      m = /^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/.exec(line);
      if (m) { out.push(m[1] + span('punct', m[2]) + m[3] + bmxInline(m[4])); continue; }

      out.push(bmxInline(line));
    }
    return indented(out, lines).join('\n');
  }

  // ---- CSS, for a `===style` section -----------------------------------------------------------
  //
  // Small on purpose: a style section is CSS, and CSS already reads well. What earns colour is the
  // difference between a SELECTOR and a PROPERTY, because that is the line a reader of a scoped
  // sheet is looking for.

  function css(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
      const rest = src.slice(i);

      if (rest.startsWith('/*')) {
        const end = rest.indexOf('*/');
        const text = end < 0 ? rest : rest.slice(0, end + 2);
        out += span('comment', text);
        i += text.length;
        continue;
      }

      if (rest[0] === '"' || rest[0] === "'") {
        const q = rest[0];
        let j = 1;
        while (j < rest.length && rest[j] !== q) j++;
        const text = rest.slice(0, Math.min(j + 1, rest.length));
        out += span('string', text);
        i += text.length;
        continue;
      }

      // a declaration: `name: value;`
      let m = /^([-a-zA-Z]+)(\s*:\s*)([^;}\n]*)/.exec(rest);
      if (m && /[{:]/.test(rest.slice(0, m[0].length)) && out.lastIndexOf('{') > out.lastIndexOf('}')) {
        out += span('prop', m[1]) + span('punct', m[2]) + span('value', m[3]);
        i += m[0].length;
        continue;
      }

      // a selector runs to the opening brace
      m = /^([^{}\n;]*[^{}\n;\s])(\s*)\{/.exec(rest);
      if (m) {
        out += span('selector', m[1]) + m[2] + span('punct', '{');
        i += m[0].length;
        continue;
      }

      out += escapeHtml(rest[0]);
      i += 1;
    }
    return out;
  }

  // ---- star-burxt's `.sbmx` --------------------------------------------------------------------
  //
  // **A composition rather than a third language, because that is what the file is.** A `.sbmx` is
  // Burxt in `===bx`, CSS in `===style.local` and `===style.global`, and BMX everywhere else — so
  // the painter finds the sections and hands each one to the painter that already knows it. Adding
  // a language here means adding a section name, not a grammar.

  function sbmx(src) {
    const lines = src.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const open = /^===([A-Za-z][A-Za-z0-9_.-]*)[ \t]*$/.exec(lines[i]);
      if (open) {
        const kind = open[1];
        const body = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '===') { body.push(lines[j]); j++; }
        const paint = kind === 'bx' ? burxt : (kind.indexOf('style') === 0 ? css : escapeHtml);
        out.push(span('section', '===' + kind));
        if (body.length) out.push(paint(body.join('\n')));
        if (j < lines.length) out.push(span('section', '==='));
        i = j + 1;
        continue;
      }
      const from = i;
      while (i < lines.length && !/^===[A-Za-z]/.test(lines[i])) i += 1;
      out.push(bmx(lines.slice(from, i).join('\n')));
    }
    // No depth pass here: this array holds GROUPS of lines, not one entry per line, so it does not
    // line up with `lines`. Each `bmx(...)` group indented itself on the way in.
    return out.join('\n');
  }

  // Wrap each painted line in a depth span, in a SECOND PASS over the finished lines.
  //
  // **Not inside the loop**, and that is not a style choice: the loop body has a dozen `continue`s, so
  // a wrapper threaded through it leaves one branch unwrapped and nothing says which. One entry per
  // source line is already an invariant here — `tools/paints.mjs` asserts the line count — so the two
  // arrays line up by construction and this pass cannot disagree with the painter.
  function indented(painted, lines) {
    let depth = 0;
    let fence = null;
    return painted.map((html, i) => {
      const line = lines[i];
      if (fence !== null) {
        if (line.trim() === fence) fence = null;
        return html;
      }
      const opens = /^(\s*)(`{3,}|~{3,})/.exec(line);
      if (opens) { fence = opens[2]; return html; }

      // **A document that indents ITSELF gets no padding.** BMX 0.6 made leading whitespace
      // insignificant, so an author can write the nesting out — and then real spaces plus this
      // padding would indent every line twice. The author's columns win; this only fills in for a
      // flat document, which is what every `.bmx` was before 0.6.
      if (/^\s/.test(line)) return html;

      // 0.7 fences: `:name:` opens, `:!name:` closes. The closer NAMES its block, so the depth is
      // recoverable from either — but it is still drawn at its opener's column, because that is the
      // column a reader compares against.
      const block = /^\s*:(!?)[A-Za-z][A-Za-z0-9_-]*:/.exec(line);
      let at = depth;
      if (block) {
        if (block[1] === '!') { depth = Math.max(0, depth - 1); at = depth; }
        else { depth += 1; }
      }
      return at > 0 ? `<span class="d${Math.min(at, 6)}">${html}</span>` : html;
    });
  }


  // ---- CSS, for a `===style` section -----------------------------------------------------------
  //
  // Small on purpose: a style section is CSS, and CSS already reads well. What earns colour is the
  // difference between a SELECTOR and a PROPERTY, because that is the line a reader of a scoped
  // sheet is looking for.

  function css(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
      const rest = src.slice(i);

      if (rest.startsWith('/*')) {
        const end = rest.indexOf('*/');
        const text = end < 0 ? rest : rest.slice(0, end + 2);
        out += span('comment', text);
        i += text.length;
        continue;
      }

      if (rest[0] === '"' || rest[0] === "'") {
        const q = rest[0];
        let j = 1;
        while (j < rest.length && rest[j] !== q) j++;
        const text = rest.slice(0, Math.min(j + 1, rest.length));
        out += span('string', text);
        i += text.length;
        continue;
      }

      // a declaration: `name: value;`
      let m = /^([-a-zA-Z]+)(\s*:\s*)([^;}\n]*)/.exec(rest);
      if (m && /[{:]/.test(rest.slice(0, m[0].length)) && out.lastIndexOf('{') > out.lastIndexOf('}')) {
        out += span('prop', m[1]) + span('punct', m[2]) + span('value', m[3]);
        i += m[0].length;
        continue;
      }

      // a selector runs to the opening brace
      m = /^([^{}\n;]*[^{}\n;\s])(\s*)\{/.exec(rest);
      if (m) {
        out += span('selector', m[1]) + m[2] + span('punct', '{');
        i += m[0].length;
        continue;
      }

      out += escapeHtml(rest[0]);
      i += 1;
    }
    return out;
  }

  // ---- star-burxt's `.sbmx` --------------------------------------------------------------------
  //
  // **A composition rather than a third language, because that is what the file is.** A `.sbmx` is
  // Burxt in `===bx`, CSS in `===style.local` and `===style.global`, and BMX everywhere else — so
  // the painter finds the sections and hands each one to the painter that already knows it. Adding
  // a language here means adding a section name, not a grammar.

  function sbmx(src) {
    const lines = src.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const open = /^===([A-Za-z][A-Za-z0-9_.-]*)[ \t]*$/.exec(lines[i]);
      if (open) {
        const kind = open[1];
        const body = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '===') { body.push(lines[j]); j++; }
        const paint = kind === 'bx' ? burxt : (kind.indexOf('style') === 0 ? css : escapeHtml);
        out.push(span('section', '===' + kind));
        if (body.length) out.push(paint(body.join('\n')));
        if (j < lines.length) out.push(span('section', '==='));
        i = j + 1;
        continue;
      }
      const from = i;
      while (i < lines.length && !/^===[A-Za-z]/.test(lines[i])) i += 1;
      out.push(bmx(lines.slice(from, i).join('\n')));
    }
    return out.join('\n');
  }

  // ---- wiring ----------------------------------------------------------------------------------

  const LANGUAGES = { burxt, bmx, sbmx, css };

  function paint() {
    for (const [language, fn] of Object.entries(LANGUAGES)) {
      const blocks = document.querySelectorAll(
        `pre > code.language-${language}, pre.language-${language} > code`,
      );
      blocks.forEach((block) => {
        if (block.dataset.painted) return;
        // textContent, never innerHTML: the text arrives already escaped by Jekyll, and reading
        // the markup back would double-escape every `<` in a Decimal<2>.
        block.innerHTML = fn(block.textContent);
        block.dataset.painted = '1';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paint, { once: true });
  } else {
    paint();
  }
})();
