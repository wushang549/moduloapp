function parseBigInt(value) {
  const raw = value.trim();
  if (!/^-?\d+$/.test(raw)) {
    throw new Error("Solo se permiten enteros.");
  }
  return BigInt(raw);
}

function absBigInt(value) {
  return value < 0n ? -value : value;
}

function mod(value, base) {
  return ((value % base) + base) % base;
}

function cleanZeroTerms(expr) {
  for (const [key, value] of expr.entries()) {
    if (value === 0n) {
      expr.delete(key);
    }
  }
}

function labelForIndex(index, steps, aNorm, nAbs) {
  if (index === 0) {
    return `a(${aNorm})`;
  }
  if (index === 1) {
    return `n(${nAbs})`;
  }
  const remIndex = index - 2;
  if (remIndex >= 0 && remIndex < steps.length) {
    return `r${remIndex}(${steps[remIndex].r})`;
  }
  return `x${index}`;
}

function formatExpression(expr, steps, aNorm, nAbs) {
  const entries = [...expr.entries()]
    .filter(([, coeff]) => coeff !== 0n)
    .sort((a, b) => a[0] - b[0]);

  if (entries.length === 0) {
    return "0";
  }

  const parts = [];
  entries.forEach(([index, coeff], idx) => {
    const sign = coeff < 0n ? "-" : "+";
    const magnitude = absBigInt(coeff);
    const label = labelForIndex(index, steps, aNorm, nAbs);
    const body = magnitude === 1n ? label : `${magnitude}*${label}`;

    if (idx === 0) {
      parts.push(coeff < 0n ? `-${body}` : body);
    } else {
      parts.push(`${sign} ${body}`);
    }
  });

  return parts.join(" ");
}

function calculateInverse(numberValue, moduloValue) {
  const aInput = parseBigInt(numberValue);
  const nInput = parseBigInt(moduloValue);

  if (nInput === 0n) {
    throw new Error("El modulo no puede ser 0.");
  }

  const nAbs = absBigInt(nInput);
  if (nAbs <= 1n) {
    throw new Error("Usa un modulo con valor absoluto mayor a 1.");
  }

  const aNorm = mod(aInput, nAbs);
  const steps = [];

  let A = aNorm;
  let B = nAbs;
  while (B !== 0n) {
    const q = A / B;
    const r = A - q * B;
    steps.push({ A, B, q, r });
    A = B;
    B = r;
  }

  const gcd = A;
  const despeje = steps
    .filter((step) => step.r !== 0n)
    .map((step, idx) => `r${idx} = ${step.A} - ${step.B}*${step.q}`);

  if (gcd !== 1n) {
    return {
      hasInverse: false,
      aInput,
      nInput,
      aNorm,
      nAbs,
      gcd,
      steps,
      despeje,
      sustitucion: [],
    };
  }

  const m = steps.length;
  const expr = new Map([[m, 1n]]);
  const sustitucion = [];

  if (m >= 2) {
    sustitucion.push(`1 = r${m - 2} (${steps[m - 2].r})`);
  } else {
    sustitucion.push("1 = a");
  }

  for (let k = m - 2; k >= 0; k -= 1) {
    const target = k + 2;
    const coeff = expr.get(target);
    if (coeff === undefined || coeff === 0n) {
      continue;
    }

    expr.delete(target);
    expr.set(k, (expr.get(k) || 0n) + coeff);
    expr.set(k + 1, (expr.get(k + 1) || 0n) - coeff * steps[k].q);
    cleanZeroTerms(expr);

    sustitucion.push(`Sustituye r${k}: r${k} = ${steps[k].A} - ${steps[k].B}*${steps[k].q}`);
    sustitucion.push(`1 = ${formatExpression(expr, steps, aNorm, nAbs)}`);
  }

  const s = expr.get(0) || 0n;
  const t = expr.get(1) || 0n;
  const inverse = mod(s, nAbs);
  const verification = mod(aNorm * inverse, nAbs);

  return {
    hasInverse: true,
    aInput,
    nInput,
    aNorm,
    nAbs,
    gcd,
    steps,
    despeje,
    sustitucion,
    s,
    t,
    inverse,
    verification,
  };
}

function renderList(title, items) {
  const block = document.createElement("article");
  block.className = "card";
  const heading = document.createElement("h2");
  heading.textContent = title;
  block.appendChild(heading);

  if (!items.length) {
    const p = document.createElement("p");
    p.textContent = "Sin pasos para mostrar.";
    block.appendChild(p);
    return block;
  }

  const ol = document.createElement("ol");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ol.appendChild(li);
  });
  block.appendChild(ol);
  return block;
}

function renderSummary(result) {
  const card = document.createElement("article");
  card.className = "card";
  const title = document.createElement("h2");
  title.textContent = "Resumen";
  card.appendChild(title);

  const lines = [];
  lines.push(`Entrada: a = ${result.aInput}, n = ${result.nInput}`);
  lines.push(`Canonico: a mod |n| = ${result.aNorm}, |n| = ${result.nAbs}`);
  lines.push(`gcd(a, n) = ${result.gcd}`);

  if (result.hasInverse) {
    lines.push(`Bezout: 1 = ${result.aNorm}*(${result.s}) + ${result.nAbs}*(${result.t})`);
    lines.push(`Inverso canonico: ${result.inverse}`);
    lines.push(`Verificacion: (${result.aNorm}*${result.inverse}) mod ${result.nAbs} = ${result.verification}`);
  } else {
    lines.push("No existe inverso multiplicativo porque gcd(a, n) != 1.");
  }

  const ul = document.createElement("ul");
  lines.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    ul.appendChild(li);
  });
  card.appendChild(ul);
  return card;
}

function renderResults(result) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  const euclidItems = result.steps.map(
    (step) => `${step.A} = ${step.B}*${step.q} + ${step.r}`
  );
  results.appendChild(renderSummary(result));
  results.appendChild(renderList("1) Algoritmo de Euclides", euclidItems));
  results.appendChild(renderList("2) Despeje de residuos", result.despeje));

  if (result.hasInverse) {
    results.appendChild(renderList("3) Sustitucion hacia atras", result.sustitucion));
  }
}

function setup() {
  const form = document.getElementById("modForm");
  const error = document.getElementById("error");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";

    const numberValue = document.getElementById("numberInput").value;
    const moduloValue = document.getElementById("moduloInput").value;

    try {
      const result = calculateInverse(numberValue, moduloValue);
      renderResults(result);
    } catch (err) {
      document.getElementById("results").innerHTML = "";
      error.textContent = err.message;
    }
  });
}

setup();
