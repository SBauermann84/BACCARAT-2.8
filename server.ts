import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/advice", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({ error: "no-key", message: "API key is missing on the server." });
      }

      const { gameType, bankroll, recentResults, currentLevel } = req.body;

      if (!bankroll) {
        return res.status(400).json({ error: "missing-data", message: "Missing session or bankroll data." });
      }

      const initialBalance = bankroll.initialBalance || 1000;
      const balance = bankroll.balance || 1000;
      const drawdown = bankroll.drawdown || 0;
      const stopLoss = bankroll.stopLoss || 100;
      const stopWin = bankroll.stopWin || 200;
      const mode = bankroll.management?.mode || "fixed";
      const profile = bankroll.management?.profile || "moderate";

      const prompt = `Analise o estado atual desta sessão de apostas de cassino online (${gameType === "roulette" ? "Roleta" : "Baccarat"}) e forneça uma análise de risco avançada e recomendações táticas inteligentes.
      
Dados da Sessão:
- Saldo Inicial: ${bankroll.currency || "R$"} ${initialBalance}
- Saldo Atual: ${bankroll.currency || "R$"} ${balance}
- Lucro Líquido: ${bankroll.currency || "R$"} ${balance - initialBalance}
- Drawdown Atual: ${drawdown}%
- Limite Stop Loss: ${bankroll.currency || "R$"} ${stopLoss}
- Limite Stop Win: ${bankroll.currency || "R$"} ${stopWin}
- Gerenciamento Ativo: Modo ${mode.toUpperCase()} (Perfil: ${profile.toUpperCase()})
- Nível de Recuperação Atual na Progressão: Nível ${currentLevel || 0}
- Últimos Resultados da Sessão: ${JSON.stringify(recentResults || [])}

Sua tarefa:
1. Calcule e classifique a volatilidade atual da sessão (Score de 0 a 100, onde >50 indica alta alternância de vitórias/derrotas ou oscilações rápidas de saldo).
2. Classifique o estresse do sistema de recuperação (Baixo, Moderado, Alto, Crítico) com base no nível atual de progressão e drawdown.
3. Forneça uma breve análise geral resumida e de alta qualidade (em português).
4. Forneça de 2 a 4 dicas táticas e contextuais extremamente acionáveis (ex: "Evite novas entradas em momentos de alta volatilidade", "Ajuste a aposta inicial para conter o drawdown", "Parar imediatamente devido à proximidade do stop-loss").`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            systemInstruction: "Você é um consultor profissional de gestão de banca e especialista em análise de risco quantitativa para jogos de cassino. Forneça insights extremamente técnicos, elegantes e diretos em português, sem clichês ou termos genéricos de marketing. Retorne estritamente um formato JSON estruturado conforme o esquema solicitado.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                volatilityScore: { 
                  type: Type.INTEGER,
                  description: "Score de 0 a 100 de volatilidade."
                },
                volatilityLabel: { 
                  type: Type.STRING,
                  description: "Classificação da volatilidade: Baixa, Média, Alta, Extrema."
                },
                recoveryStress: { 
                  type: Type.STRING,
                  description: "Classificação do estresse de recuperação: Baixo, Moderado, Alto, Crítico."
                },
                analysis: { 
                  type: Type.STRING,
                  description: "Breve análise contextual detalhada do comportamento atual da sessão (em português)."
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista de 2 a 4 recomendações táticas ultra-precisas."
                }
              },
              required: ["volatilityScore", "volatilityLabel", "recoveryStress", "analysis", "recommendations"]
            }
          }
        });
      } catch (firstError: any) {
        // Log busy or quota status gracefully without printing stack traces
        const errorMsg = firstError?.message || "";
        const isBusy = errorMsg.includes("503") || firstError?.status === 503;
        const isQuota = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || firstError?.status === 429;
        
        if (isBusy) {
          console.log("Gemini 2.5-flash is temporarily busy (503). Retrying with gemini-2.5-pro...");
        } else if (isQuota) {
          console.log("Gemini 2.5-flash free-tier quota exhausted (429). Retrying with gemini-2.5-pro...");
        } else {
          console.warn("Primary model attempt failed:", errorMsg || firstError);
        }

        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
              systemInstruction: "Você é um consultor profissional de gestão de banca e especialista em análise de risco quantitativa para jogos de cassino. Forneça insights extremamente técnicos, elegantes e diretos em português, sem clichês ou termos genéricos de marketing. Retorne estritamente um formato JSON estruturado conforme o esquema solicitado.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  volatilityScore: { 
                    type: Type.INTEGER,
                    description: "Score de 0 a 100 de volatilidade."
                  },
                  volatilityLabel: { 
                    type: Type.STRING,
                    description: "Classificação da volatilidade: Baixa, Média, Alta, Extrema."
                  },
                  recoveryStress: { 
                    type: Type.STRING,
                    description: "Classificação do estresse de recuperação: Baixo, Moderado, Alto, Crítico."
                  },
                  analysis: { 
                    type: Type.STRING,
                    description: "Breve análise contextual detalhada do comportamento atual da sessão (em português)."
                  },
                  recommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Lista de 2 a 4 recomendações táticas ultra-precisas."
                  }
                },
                required: ["volatilityScore", "volatilityLabel", "recoveryStress", "analysis", "recommendations"]
              }
            }
          });
        } catch (secondError: any) {
          const secondMsg = secondError?.message || "";
          const isSecondBusy = secondMsg.includes("503") || secondError?.status === 503;
          const isSecondQuota = secondMsg.includes("429") || secondMsg.includes("RESOURCE_EXHAUSTED") || secondError?.status === 429;
          
          if (isSecondBusy) {
            console.log("Both Gemini models are temporarily experiencing high demand (503). Activating offline fallback.");
          } else if (isSecondQuota) {
            console.log("Gemini API limits/quota reached (429). Activating offline fallback.");
          } else {
            console.warn("Fallback model attempt failed:", secondMsg || secondError);
          }
          return res.status(200).json({ 
            error: "api-unavailable", 
            message: "Gemini model is currently busy or quota was exceeded. Activating local mathematical engine fallback." 
          });
        }
      }

      const responseText = response.text || "{}";
      const adviceResult = JSON.parse(responseText.trim());
      res.json(adviceResult);

    } catch (error: any) {
      console.warn("Advisor API Request completed with offline transition:", error?.message || error);
      res.status(200).json({ 
        error: "api-unavailable", 
        message: error.message || "Unknown error inside server-side Gemini call." 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
