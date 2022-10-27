function* streamContentEvents(node) {
  if (node.firstChild === null) {
    return;
  }

  const parentStack = [];
  for (let current = node.firstChild; current !== node; ) {
    yield {
      type: current.nodeName === '#text' ? 'text' : 'tag-open',
      node: current,
    };

    if (current.firstChild !== null) {
      parentStack.push(current);
      current = current.firstChild;
      continue;
    }

    if (current.nextSibling !== null) {
      if (current.innerHTML === '') {
        yield { type: 'tag-close', node: current };
      }

      current = current.nextSibling;
      continue;
    }

    do {
      const parent = parentStack.pop();
      if (parent === undefined) {
        return;
      }

      current = parent;
      yield { type: 'tag-close', node: current };
    } while (current.nextSibling === null);
    current = current.nextSibling;
  }
}

function getContentEvents(node) {
  const events = [];
  for (const event of streamContentEvents(node)) {
    events.push(event);
  }

  return events;
}

function* streamSpaceRemovalCandidates(contentEvents) {
  let isAtLineStart = true;
  let contentEventIndex = 0;
  let startIndex = 0;
  let count = 0;
  for (; contentEventIndex < contentEvents.length; contentEventIndex += 1) {
    const contentEvent = contentEvents[contentEventIndex];
    switch (contentEvent.type) {
    case 'text':
      break;
    case 'tag-open':
      if (isAtLineStart) {
        if (count !== 0) {
          yield { contentEventIndex: contentEventIndex - 1, startIndex, count };
        }

        isAtLineStart = false;
      }

      break;
    default:
      continue;
    }

    const text = contentEvent.node.textContent;
    startIndex = 0;
    count = 0;
    for (let j = 0; j < text.length; j += 1) {
      const symbol = text[j];
      if (isAtLineStart) {
        switch (symbol) {
        case '\n':
          yield { contentEventIndex, startIndex, count: 1 };
          count = 0;
          startIndex = j + 1;
          break;
        case ' ':
          count += 1;
          break;
        default:
          isAtLineStart = false;
          yield { contentEventIndex, startIndex, count };
          break;
        }
      } else if (symbol === '\n') {
        isAtLineStart = true;
        startIndex = j + 1;
        count = 0;
      }
    }
  }

  if (isAtLineStart) {
    contentEventIndex -= 1;
    const contentEvent = contentEvents[contentEventIndex];
    if (contentEvent.node.textContent[startIndex - 1] === '\n') {
      yield { contentEventIndex, startIndex: startIndex - 1, count: 1 }
    }

    yield { contentEventIndex, startIndex, count };
  }
}

function doesRemoveSpaceOnlyContent(contentEvents, spaceRemovalTarget) {
  const contentEvent = contentEvents[spaceRemovalTarget.contentEventIndex];
  const text = contentEvent.node.textContent;
  for (let i = spaceRemovalTarget.startIndex; i < text.length; i += 1) {
    if (text[i] !== ' ') {
      return false;
    }
  }

  return true;
}

function getIndentation(contentEvents, spaceRemovalTargets) {
  let indentation = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < spaceRemovalTargets.length; i += 1) {
    const target = spaceRemovalTargets[i];
    const contentEvent = contentEvents[target.contentEventIndex];
    const text = contentEvent.node.textContent;
    if (text[target.startIndex] === '\n') {
      continue;
    }

    if (i + 1 === spaceRemovalTargets.length
        && doesRemoveSpaceOnlyContent(contentEvents, target)) {
      continue;
    }

    if (target.count < indentation) {
      indentation = target.count;
    }
  }

  return indentation;
}

function applyIndentation(indentation, contentEvents, spaceRemovalTargets) {
  for (let i = 0; i < spaceRemovalTargets.length; i += 1) {
    const target = spaceRemovalTargets[i];
    const contentEvent = contentEvents[target.contentEventIndex];
    const text = contentEvent.node.textContent;
    if (text[target.startIndex] === '\n') {
      continue;
    }

    if (i + 1 === spaceRemovalTargets.length
        && doesRemoveSpaceOnlyContent(contentEvents, target)) {
      continue;
    }

    target.count = indentation;
  }
}

function getSpaceRemovalTargets(contentEvents) {
  const targets = [];
  for (const candidate of streamSpaceRemovalCandidates(contentEvents)) {
    targets.push(candidate);
  }

  const indentation = getIndentation(contentEvents, targets);
  applyIndentation(indentation, contentEvents, targets);

  return targets;
}

function* reconstructNodeQueryingText(rootClone, contentEvents) {
  const parentStack = [rootClone];
  for (let eventIndex = 0; eventIndex < contentEvents.length; eventIndex += 1) {
    const parent = parentStack[parentStack.length - 1];
    const contentEvent = contentEvents[eventIndex];
    switch (contentEvent.type) {
    case 'text':
      const content = yield eventIndex;
      const text = document.createTextNode(content);
      parent.appendChild(text);
      break;
    case 'tag-open':
      const tag = contentEvent.node.cloneNode();
      parent.appendChild(tag);
      parentStack.push(tag);
      break;
    case 'tag-close':
      parentStack.pop();
      break;
    }
  }
}

function reconstructNode(rootClone, contentEvents, spaceRemovalTargets) {
  let targetIndex = 0;
  const reconstructor = reconstructNodeQueryingText(rootClone, contentEvents);
  for (let query = reconstructor.next(); !query.done; ) {
    const contentEventIndex = query.value;
    const contentEvent = contentEvents[contentEventIndex];
    const text = contentEvent.node.textContent;
    const buffer = [];

    let i = 0;
    for (; targetIndex < spaceRemovalTargets.length; targetIndex += 1) {
      const target = spaceRemovalTargets[targetIndex];
      if (target.contentEventIndex !== contentEventIndex) {
        break;
      }

      for (; i < target.startIndex; i += 1) {
        buffer.push(text[i]);
      }

      i += target.count;
    }

    for (; i < text.length; i += 1) {
      buffer.push(text[i]);
    }

    query = reconstructor.next(buffer.join(''));
  }
}

function reindent(node, contentEvents) {
  const targets = getSpaceRemovalTargets(contentEvents);
  const clone = node.cloneNode();
  reconstructNode(clone, contentEvents, targets);
  node.replaceWith(clone);
  return clone;
}

function preformat(node) {
  node.style.display = 'block';
  node.style.whiteSpace = 'pre-wrap';
}

function isMultiline(contentEvents) {
  for (const event of contentEvents) {
    if (event.type !== 'text') {
      continue;
    }
  
    for (const symbol of event.node.textContent) {
      if (symbol === '\n') {
        return true;
      }
    }
  }

  return false;
}

function* streamColorableSymbols(contentEvents) {
  let noColorNode = null;
  let ignoreNode = null;
  for (const event of contentEvents) {
    switch (event.type) {
    case 'tag-open':
      if (noColorNode === null
          && event.node.getAttribute('data-ignore') !== null) {
        ignoreNode = event.node;
      }

      if (ignoreNode
          && event.node.getAttribute('data-no-color') !== null) {
        noColorNode = event.node;
      }

      continue;

    case 'tag-close':
      if (event.node === noColorNode) {
        noColorNode = null;
      }

      if (event.node === ignoreNode) {
        ignoreNode = null;
      }

      continue;
    }

    const text = event.node.textContent;
    for (let i = 0; i < text.length; i += 1) {
      yield {
        value: ignoreNode === null ? text[i] : ' ',
        node: event.node,
        inNodePosition: i,
        isColorable: noColorNode === null,
      };
    }
  }
}

function getColorableSymbols(contentEvents) {
  const symbols = [];
  for (const symbol of streamColorableSymbols(contentEvents)) {
    symbols.push(symbol);
  }

  return symbols;
}

function putTextRangeIntoSpan(node, startIndex, exclusiveEndIndex, cssClasses) {
  const span = document.createElement('span');
  for (const cssClass of cssClasses) {
    span.classList.add(cssClass);
  }

  const spanText = node.textContent.slice(startIndex, exclusiveEndIndex);
  const spanContent = document.createTextNode(spanText);
  span.appendChild(spanContent);
  node.parentNode.insertBefore(span, node.nextSibling);

  const remainingText = node.textContent.slice(exclusiveEndIndex);
  const remainingContent = document.createTextNode(remainingText);
  node.parentNode.insertBefore(remainingContent, span.nextSibling);

  const frontText = node.textContent.slice(0, startIndex);
  node.textContent = frontText;

  return [spanContent, remainingContent];
}

function adjustSymbolsPositions(symbols, spanned, remaining, startIndex) {
  let i = 0;
  for (; i < spanned.textContent.length; i += 1) {
    const symbol = symbols[startIndex + i];
    symbol.node = spanned;
    symbol.inNodePosition = i;
  }

  for (let j = 0; j < remaining.textContent.length; j += 1) {
    const symbol = symbols[startIndex + i + j];
    symbol.node = remaining;
    symbol.inNodePosition = j;
  }
}

function colorSymbols(symbols, startIndex, count, cssClasses) {
  if (count === 0) {
    const endIndex = startIndex;
    console.warn(`Can't highlight symbols from ${startIndex} to ${endIndex} inclusive.`);
    return;
  }

  const exclusiveEndIndex = startIndex + count;
  if (startIndex >= symbols.length || exclusiveEndIndex > symbols.length) {
    const endIndex = exclusiveEndIndex - 1;
    console.error(`Can't highlight symbols from ${startIndex} to ${endIndex} inclusive.`);
    return;
  }

  let startSymbol = symbols[startIndex];
  for (let i = startIndex + 1, j = 1; i <= exclusiveEndIndex; i += 1) {
    if (i === exclusiveEndIndex || symbols[i].node !== startSymbol.node) {
      const [spanned, remaining] = putTextRangeIntoSpan(
        startSymbol.node,
        startSymbol.inNodePosition,
        startSymbol.inNodePosition + j,
        cssClasses,
      );

      startIndex = i - j;
      adjustSymbolsPositions(symbols, spanned, remaining, startIndex);
      startSymbol = symbols[i];
      j = 1;
    } else {
      j += 1;
    }
  }
}

function sliceSymbols(symbols, startIndex, exclusiveEndIndex) {
  if (startIndex >= symbols.length || exclusiveEndIndex > symbols.length) {
    const endIndex = exclusiveEndIndex - 1;
    console.error(`Can't slice symbols from ${startIndex} to ${endIndex} inclusive.`);
    return '';
  }

  const buffer = [];
  for (let i = startIndex; i < exclusiveEndIndex; i += 1) {
    buffer.push(symbols[i].value);
  }

  return buffer.join('');
}

function hlWithRules(input, rules) {
  const text = input.toString();
  for (const { pattern, classes } of rules) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      input.hl(match.index, match[0].length, classes);
    }
  }
}

const colorableInputProxyHandler = {
  get: (symbols, propertyName) => {
    switch (propertyName) {
    case 'length':
      return symbols.length;

    case 'slice':
      return (startIndex, exclusiveEndIndex) => {
        return sliceSymbols(symbols, startIndex, exclusiveEndIndex);
      }

    case 'toString':
      return () => {
        return sliceSymbols(symbols, 0, symbols.length);
      };

    case 'hl':
      return (startIndex, count, cssClasses) => {
        colorSymbols(symbols, startIndex, count, cssClasses);
      };

    default:
      const symbol = symbols[propertyName];
      if (symbol === undefined) {
        propertyName = propertyName.replace('\'', '\\\'');
        console.error(`Input doesn't have '${propertyName}' property.`);
        return undefined;
      }

      return symbol.value;
    }
  },
};

const hl = new class {
  #engines;

  constructor() {
    this.#engines = new Map();
  }

  add(language, engine) {
    switch (typeof engine) {
    case 'function':
      this.#engines.set(language, engine);
      break;
    case 'object':
      const rules = engine;
      this.#engines.set(language, input => hlWithRules(input, rules));
      break;
    default:
      console.error(`Expected '${language}' syntax highlighter to be either an array or a function.`);
      this.#engines.set(language, () => { });
      break;
    }
  }

  find(language) {
    return this.#engines.get(language);
  }
};

function highlightCode(language, contentEvents) {
  const engine = hl.find(language); 
  if (engine === undefined) {
    language = language.replace('\'', '\\\'');
    console.error(`Can't find '${language}' syntax highlighter.`);
  } else {
    const symbols = getColorableSymbols(contentEvents);
    const colorableInput = new Proxy(symbols, colorableInputProxyHandler);
    engine(colorableInput);
  }
}

function processCodeBlocks() {
  for (let code of document.getElementsByTagName('code')) {
    let contentEvents = getContentEvents(code);
    if (isMultiline(contentEvents)) {
      preformat(code);
      code = reindent(code, contentEvents);
      contentEvents = getContentEvents(code);
    }

    const language = code.getAttribute('data-hl');
    if (language !== null) {
      highlightCode(language, contentEvents);
    }
  }
}

window.addEventListener('load', () => {
  processCodeBlocks();
});
