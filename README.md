# `notex.js`

For those who don't want to &#x1F92C; with LaTeX and want to use HTML and
CSS.

## Table of Contents

- [Quick Start](#quick-start)
- [Code Blocks](#code-blocks)
  - [Automatic multiline code reindentation and preformatting](#automatic-multiline-code-reindentation-and-preformatting)
  - [Custom syntax highlighting](#custom-syntax-highlighting)
    - [Using regex](#using-regex)
    - [Manually](#manually)
  - [Nested tags support](#nested-tags-support)
- [Formulas <b>(not implemented)</b>](#formulas)
  - [Basic LaTeX syntax support <b>(not implemented)</b>](#basic-latex-syntax-support)
- [Page breaking <b>(not implemented)</b>](#page-breaking)

## Quick Start

Include the script at the head of your document without deferring it.

```html
<script src="notex.js"></script>
```

## Code Blocks

### Automatic multiline code reindentation and preformatting

The script automatically reindents multiline code blocks and applies
`style="display: block; white-space: pre-wrap;"`, making this

```html
<code>
  def sum(x, y):
      return x + y
</code>
```

look like this.

<pre><code>def sum(x, y):
    return x + y</code></pre>

### Custom syntax highlighting

#### Using regex

You can automate syntax highlighting using `hl.add` method,

```html
<script>
  hl.add('python', [
    {
      pattern: /\b(def)|(return)\b/g,
      classes: ['keyword'],
    },
  ]);
</script>
```

which makes this

```html
<code data-hl="python">
  def sum(x, y):
      return x + y
</code>
```

look like this,

<pre><code><b>def</b> sum(x, y):
    <b>return</b> x + y</code></pre>

if you add some CSS.

```css
span.keyword {
  font-weight: bold;
}
```

#### Manually

You can pass a function to `hl.add` to highlight code blocks manually. For
example, this

```html
<script>
  hl.add('python', input => {
    input.hl(
      0, // start
      3, // length
      ['keyword'],
    );

    // input behaves almost like an array
    // input[0] => 'd'
    // input[1] => 'e'
    // ...
    // input[input.length - 1] => 'y'

    // you can still use regex via hlWithRules(input, arrayOfRules) function
  });
</script>
```

makes this

```html
<code data-hl="python">
  def sum(x, y):
      return x + y
</code>
```

look like this.

<pre><code><b>def</b> sum(x, y):
    return x + y</code></pre>

### Nested tags support

The script can handle tags inside code blocks. For example, this HTML (line
breaks are inserted for readability)

```html
<code data-hl="python">
  d
  <i>ef</i>
   sum(x, y):
  <s>  <u></u>  </s>
  return x + y
</code>
```

will be converted into this.

```html
<code data-hl="python">
  <span class="keyword">d</span>
  <i><span class="keyword">ef</span></i>
   sum(x, y):
  <s>  <u></u>  </s>
  <span class="keyword">return</span>
   x + y
</code>
```

So you can manually add some styling directly inside the code block.

## Formulas

### Basic LaTeX syntax support

## Page breaking
