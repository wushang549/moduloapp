#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

using ll = long long;

enum class SourceKind { OrigA, OrigN, Rem };

struct Source {
    SourceKind kind;
    int remIndex;
};

struct Step {
    ll A;
    ll B;
    ll q;
    ll r;
    Source sourceA;
    Source sourceB;
    int remIndex;
};

struct Term {
    ll coeff;
    Source source;
};

static void printLine(const std::string& line) {
    std::cout << line << "\n" << std::flush;
    std::this_thread::sleep_for(std::chrono::milliseconds(200));
}

static ll mulMod(ll x, ll y, ll mod) {
    ll a = ((x % mod) + mod) % mod;
    ll b = ((y % mod) + mod) % mod;
    ll result = 0;

    while (b > 0) {
        if (b & 1LL) {
            if (result >= mod - a) {
                result = result - (mod - a);
            } else {
                result += a;
            }
        }

        if (a >= mod - a) {
            a = a - (mod - a);
        } else {
            a += a;
        }

        b >>= 1LL;
    }

    return result;
}

static bool sameSource(const Source& x, const Source& y) {
    return x.kind == y.kind && x.remIndex == y.remIndex;
}

static std::string sourceValueToString(const Source& s, ll a, ll n, const std::vector<ll>& remValues) {
    if (s.kind == SourceKind::OrigA) {
        return std::to_string(a);
    }
    if (s.kind == SourceKind::OrigN) {
        return std::to_string(n);
    }
    if (s.remIndex >= 0 && s.remIndex < static_cast<int>(remValues.size())) {
        return std::to_string(remValues[s.remIndex]);
    }
    return "0";
}

template <typename BodyFn>
static std::string formatExpressionGeneric(const std::vector<Term>& terms, BodyFn bodyFn) {
    if (terms.empty()) {
        return "0";
    }

    std::string out;
    bool first = true;

    for (const auto& t : terms) {
        if (t.coeff == 0) {
            continue;
        }
        ll absCoeff = std::llabs(t.coeff);
        std::string body = bodyFn(t, absCoeff);

        if (first) {
            if (t.coeff < 0) {
                out += "-";
            }
            out += body;
            first = false;
        } else {
            if (t.coeff < 0) {
                out += " - ";
            } else {
                out += " + ";
            }
            out += body;
        }
    }

    if (out.empty()) {
        return "0";
    }
    return out;
}

static std::string formatExpression(const std::vector<Term>& terms, ll a, ll n, const std::vector<ll>& remValues) {
    return formatExpressionGeneric(terms, [&](const Term& t, ll absCoeff) {
        std::string value = sourceValueToString(t.source, a, n, remValues);
        if (absCoeff == 1) {
            return value;
        }
        return value + " x " + std::to_string(absCoeff);
    });
}

static std::string formatExpressionWithSubstitution(const std::vector<Term>& terms,
                                                    const Step& substStep,
                                                    ll a,
                                                    ll n,
                                                    const std::vector<ll>& remValues) {
    return formatExpressionGeneric(terms, [&](const Term& t, ll absCoeff) {
        if (t.source.kind == SourceKind::Rem && t.source.remIndex == substStep.remIndex) {
            std::string rhs = "(" + std::to_string(substStep.A) + " - " + std::to_string(substStep.B) +
                              " x " + std::to_string(substStep.q) + ")";
            if (absCoeff == 1) {
                return rhs;
            }
            return rhs + " x " + std::to_string(absCoeff);
        }

        std::string value = sourceValueToString(t.source, a, n, remValues);
        if (absCoeff == 1) {
            return value;
        }
        return value + " x " + std::to_string(absCoeff);
    });
}

static std::vector<Term> combineTerms(const std::vector<Term>& in) {
    std::vector<Term> out;
    for (const auto& t : in) {
        if (t.coeff == 0) {
            continue;
        }

        bool found = false;
        for (auto& u : out) {
            if (sameSource(t.source, u.source)) {
                u.coeff += t.coeff;
                found = true;
                break;
            }
        }

        if (!found) {
            out.push_back(t);
        }
    }

    std::vector<Term> cleaned;
    for (const auto& t : out) {
        if (t.coeff != 0) {
            cleaned.push_back(t);
        }
    }
    return cleaned;
}

static int pickRemainderToExpand(const std::vector<Term>& terms, const std::unordered_map<int, int>& remToStep) {
    int best = -1;
    for (const auto& t : terms) {
        if (t.source.kind != SourceKind::Rem || t.coeff == 0) {
            continue;
        }
        if (remToStep.find(t.source.remIndex) == remToStep.end()) {
            continue;
        }
        if (t.source.remIndex > best) {
            best = t.source.remIndex;
        }
    }
    return best;
}

int main() {
    ll a, n;

    std::cout << "num1: " << std::flush;
    if (!(std::cin >> a)) {
        return 0;
    }

    std::cout << "mod: " << std::flush;
    if (!(std::cin >> n)) {
        return 0;
    }

    printLine(std::to_string(a) + " x == 1 mod " + std::to_string(n));
    printLine("");

    printLine("1. Algoritmo de Euclides");

    std::vector<Step> steps;
    std::vector<ll> remValues;
    std::unordered_map<int, int> remToStep;

    Source sourceA{SourceKind::OrigA, -1};
    Source sourceN{SourceKind::OrigN, -1};
    Source sourceB = sourceN;

    int remCounter = 0;

    if (n != 0) {
        ll A = a;
        ll B = n;

        while (B != 0) {
            ll q = A / B;
            ll r = A - q * B;

            Step st{A, B, q, r, sourceA, sourceB, remCounter++};
            steps.push_back(st);
            remValues.push_back(r);

            if (r != 0) {
                remToStep[st.remIndex] = static_cast<int>(steps.size()) - 1;
            }

            printLine(std::to_string(st.A) + " = " + std::to_string(st.B) + " x " + std::to_string(st.q) + " + " +
                      std::to_string(st.r));

            if (r == 0) {
                break;
            }

            Source sourceR{SourceKind::Rem, st.remIndex};
            A = B;
            B = r;
            sourceA = sourceB;
            sourceB = sourceR;
        }
    }

    ll gcdValue = 0;
    int gcdStepIndex = -1;

    if (n == 0) {
        gcdValue = std::llabs(a);
    } else if (!steps.empty()) {
        if (steps.back().r == 0) {
            if (steps.size() == 1) {
                gcdValue = std::llabs(steps.back().B);
            } else {
                gcdStepIndex = static_cast<int>(steps.size()) - 2;
                gcdValue = std::llabs(steps[gcdStepIndex].r);
            }
        }
    }

    printLine("Nota: gcd(a,n) es el ultimo residuo distinto de cero.");
    printLine("gcd(a,n) = " + std::to_string(gcdValue));

    if (gcdValue != 1 || n == 0) {
        printLine("No existe inverso multiplicativo en Z_n porque gcd(a,n) != 1");
        return 0;
    }

    printLine("gcd(a,n)=1");
    printLine("");

    printLine("2. Despejar residuos");
    for (const auto& st : steps) {
        if (st.r == 0) {
            continue;
        }
        printLine(std::to_string(st.r) + " = " + std::to_string(st.A) + " - " + std::to_string(st.B) + " x " +
                  std::to_string(st.q));
    }
    printLine("");

    printLine("3. Se hace sustitucion hacia atras");

    if (gcdStepIndex < 0) {
        printLine("1 = " + std::to_string(n));
    }

    std::vector<Term> current;
    if (gcdStepIndex >= 0) {
        const Step& gStep = steps[gcdStepIndex];
        current.push_back(Term{1, gStep.sourceA});
        current.push_back(Term{-gStep.q, gStep.sourceB});
        current = combineTerms(current);
        printLine("1 = " + formatExpression(current, a, n, remValues));
    }

    while (true) {
        int remToExpand = pickRemainderToExpand(current, remToStep);
        if (remToExpand < 0) {
            break;
        }

        int idx = remToStep[remToExpand];
        const Step& subst = steps[idx];

        printLine("1 = " + formatExpressionWithSubstitution(current, subst, a, n, remValues));

        std::vector<Term> next;
        for (const auto& t : current) {
            if (t.source.kind == SourceKind::Rem && t.source.remIndex == remToExpand) {
                next.push_back(Term{t.coeff, subst.sourceA});
                next.push_back(Term{-t.coeff * subst.q, subst.sourceB});
            } else {
                next.push_back(t);
            }
        }

        current = combineTerms(next);
        printLine("1 = " + formatExpression(current, a, n, remValues));
    }
    printLine("");

    ll s = 0;
    ll t = 0;
    for (const auto& term : current) {
        if (term.source.kind == SourceKind::OrigA) {
            s += term.coeff;
        } else if (term.source.kind == SourceKind::OrigN) {
            t += term.coeff;
        }
    }

    ll modBase = std::llabs(n);
    ll canon = ((s % modBase) + modBase) % modBase;
    ll normA = ((a % modBase) + modBase) % modBase;
    ll verification = mulMod(normA, canon, modBase);

    printLine("Teorema de Bezout");
    printLine("1 = " + std::to_string(a) + " x " + std::to_string(s) + " + " + std::to_string(n) + " x " +
              std::to_string(t));
    printLine("");

    printLine("Metodo normal");
    printLine("s = " + std::to_string(s));
    printLine("");

    printLine("Numero canonico");
    printLine("((s mod n) + n) mod n = " + std::to_string(canon));
    printLine("(" + std::to_string(a) + " x " + std::to_string(canon) + ") mod " + std::to_string(n) + " = " +
              std::to_string(verification));
    printLine("Entonces el inverso multiplicativo de a es s mod n = " + std::to_string(canon));

    return 0;
}
