const SourceKind = {
  ORIG_A: "OrigA",
  ORIG_N: "OrigN",
  REM: "Rem",
};

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

function mulMod(x, y, modBase) {
  const a = ((x % modBase) + modBase) % modBase;
  const b = ((y % modBase) + modBase) % modBase;
  return (a * b) % modBase;
}

function sameSource(x, y) {
  return x.kind === y.kind && x.remIndex === y.remIndex;
}

function sourceValueToString(source, a, n, remValues) {
  if (source.kind === SourceKind.ORIG_A) {
    return a.toString();
  }
  if (source.kind === SourceKind.ORIG_N) {
    return n.toString();
  }
  if (
    source.kind === SourceKind.REM &&
    source.remIndex >= 0 &&
    source.remIndex < remValues.length
  ) {
    return remValues[source.remIndex].toString();
  }
  return "0";
}

function formatExpressionGeneric(terms, bodyFn) {
  if (!terms.length) {
    return "0";
  }

  let out = "";
  let first = true;

  for (const t of terms) {
    if (t.coeff === 0n) {
      continue;
    }

    const absCoeff = absBigInt(t.coeff);
    const body = bodyFn(t, absCoeff);

    if (first) {
      if (t.coeff < 0n) {
        out += "-";
      }
      out += body;
      first = false;
    } else {
      out += t.coeff < 0n ? " - " : " + ";
      out += body;
    }
  }

  return out === "" ? "0" : out;
}

function formatExpression(terms, a, n, remValues) {
  return formatExpressionGeneric(terms, (t, absCoeff) => {
    const value = sourceValueToString(t.source, a, n, remValues);
    if (absCoeff === 1n) {
      return value;
    }
    return `${value} x ${absCoeff}`;
  });
}

function formatExpressionWithSubstitution(terms, substStep, a, n, remValues) {
  return formatExpressionGeneric(terms, (t, absCoeff) => {
    if (
      t.source.kind === SourceKind.REM &&
      t.source.remIndex === substStep.remIndex
    ) {
      const rhs = `(${substStep.A} - ${substStep.B} x ${substStep.q})`;
      if (absCoeff === 1n) {
        return rhs;
      }
      return `${rhs} x ${absCoeff}`;
    }

    const value = sourceValueToString(t.source, a, n, remValues);
    if (absCoeff === 1n) {
      return value;
    }
    return `${value} x ${absCoeff}`;
  });
}

function combineTerms(inputTerms) {
  const out = [];

  for (const t of inputTerms) {
    if (t.coeff === 0n) {
      continue;
    }

    let found = false;
    for (const u of out) {
      if (sameSource(t.source, u.source)) {
        u.coeff += t.coeff;
        found = true;
        break;
      }
    }

    if (!found) {
      out.push({ coeff: t.coeff, source: t.source });
    }
  }

  return out.filter((t) => t.coeff !== 0n);
}

function pickRemainderToExpand(terms, remToStep) {
  let best = -1;

  for (const t of terms) {
    if (t.source.kind !== SourceKind.REM || t.coeff === 0n) {
      continue;
    }
    if (!remToStep.has(t.source.remIndex)) {
      continue;
    }
    if (t.source.remIndex > best) {
      best = t.source.remIndex;
    }
  }

  return best;
}

function buildConsoleLines(numberValue, moduloValue) {
  const a = parseBigInt(numberValue);
  const n = parseBigInt(moduloValue);
  const lines = [];

  lines.push(`${a} x == 1 mod ${n}`);
  lines.push("");
  lines.push("1. Algoritmo de Euclides");

  const steps = [];
  const remValues = [];
  const remToStep = new Map();

  let sourceA = { kind: SourceKind.ORIG_A, remIndex: -1 };
  const sourceN = { kind: SourceKind.ORIG_N, remIndex: -1 };
  let sourceB = sourceN;
  let remCounter = 0;

  if (n !== 0n) {
    let A = a;
    let B = n;

    while (B !== 0n) {
      const q = A / B;
      const r = A - q * B;
      const st = {
        A,
        B,
        q,
        r,
        sourceA,
        sourceB,
        remIndex: remCounter,
      };
      remCounter += 1;

      steps.push(st);
      remValues.push(r);
      if (r !== 0n) {
        remToStep.set(st.remIndex, steps.length - 1);
      }

      lines.push(`${st.A} = ${st.B} x ${st.q} + ${st.r}`);

      if (r === 0n) {
        break;
      }

      const sourceR = { kind: SourceKind.REM, remIndex: st.remIndex };
      A = B;
      B = r;
      sourceA = sourceB;
      sourceB = sourceR;
    }
  }

  let gcdValue = 0n;
  let gcdStepIndex = -1;

  if (n === 0n) {
    gcdValue = absBigInt(a);
  } else if (steps.length > 0) {
    const last = steps[steps.length - 1];
    if (last.r === 0n) {
      if (steps.length === 1) {
        gcdValue = absBigInt(last.B);
      } else {
        gcdStepIndex = steps.length - 2;
        gcdValue = absBigInt(steps[gcdStepIndex].r);
      }
    }
  }

  lines.push("Nota: gcd(a,n) es el ultimo residuo distinto de cero.");
  lines.push(`gcd(a,n) = ${gcdValue}`);

  if (gcdValue !== 1n || n === 0n) {
    lines.push("No existe inverso multiplicativo en Z_n porque gcd(a,n) != 1");
    return lines;
  }

  lines.push("gcd(a,n)=1");
  lines.push("");

  lines.push("2. Despejar residuos");
  for (const st of steps) {
    if (st.r === 0n) {
      continue;
    }
    lines.push(`${st.r} = ${st.A} - ${st.B} x ${st.q}`);
  }
  lines.push("");

  lines.push("3. Se hace sustitucion hacia atras");
  if (gcdStepIndex < 0) {
    lines.push(`1 = ${n}`);
  }

  let current = [];
  if (gcdStepIndex >= 0) {
    const gStep = steps[gcdStepIndex];
    current.push({ coeff: 1n, source: gStep.sourceA });
    current.push({ coeff: -gStep.q, source: gStep.sourceB });
    current = combineTerms(current);
    lines.push(`1 = ${formatExpression(current, a, n, remValues)}`);
  }

  while (true) {
    const remToExpand = pickRemainderToExpand(current, remToStep);
    if (remToExpand < 0) {
      break;
    }

    const idx = remToStep.get(remToExpand);
    const subst = steps[idx];
    lines.push(
      `1 = ${formatExpressionWithSubstitution(current, subst, a, n, remValues)}`
    );

    const next = [];
    for (const t of current) {
      if (t.source.kind === SourceKind.REM && t.source.remIndex === remToExpand) {
        next.push({ coeff: t.coeff, source: subst.sourceA });
        next.push({ coeff: -t.coeff * subst.q, source: subst.sourceB });
      } else {
        next.push(t);
      }
    }

    current = combineTerms(next);
    lines.push(`1 = ${formatExpression(current, a, n, remValues)}`);
  }
  lines.push("");

  let s = 0n;
  let t = 0n;
  for (const term of current) {
    if (term.source.kind === SourceKind.ORIG_A) {
      s += term.coeff;
    } else if (term.source.kind === SourceKind.ORIG_N) {
      t += term.coeff;
    }
  }

  const modBase = absBigInt(n);
  const canon = ((s % modBase) + modBase) % modBase;
  const normA = ((a % modBase) + modBase) % modBase;
  const verification = mulMod(normA, canon, modBase);

  lines.push("Teorema de Bezout");
  lines.push(`1 = ${a} x ${s} + ${n} x ${t}`);
  lines.push("");

  lines.push("Metodo normal");
  lines.push(`s = ${s}`);
  lines.push("");

  lines.push("Numero canonico");
  lines.push(`((s mod n) + n) mod n = ${canon}`);
  lines.push(`(${a} x ${canon}) mod ${n} = ${verification}`);
  lines.push(`Entonces el inverso multiplicativo de a es s mod n = ${canon}`);

  return lines;
}

function renderConsole(lines) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  const pre = document.createElement("pre");
  pre.className = "console";
  pre.textContent = lines.join("\n");
  results.appendChild(pre);
}

function setup() {
  const form = document.getElementById("modForm");
  const error = document.getElementById("error");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    document.getElementById("results").innerHTML = "";

    const numberValue = document.getElementById("numberInput").value;
    const moduloValue = document.getElementById("moduloInput").value;

    try {
      const lines = buildConsoleLines(numberValue, moduloValue);
      renderConsole(lines);
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

if (typeof document !== "undefined") {
  setup();
}
