// src/lib/knowledge.ts

export interface Asset {
  id: number;
  name: string;
  type: string;
}

export const KNOWLEDGE_BASE = {
  // === ASSETS ESENCIALES (Top 50 usados en Roblox) ===
  assets: {
    weapons: [
      { id: 47433, name: "Medieval Sword", type: "Mesh" },
      { id: 158635665, name: "Classic Pistol", type: "Model" },
      { id: 92847, name: "Katana", type: "Model" }
    ],
    vehicles: [
      { id: 4867403212, name: "Basic Car Chassis", type: "Model" }
    ],
    npcs: [
      { id: 5165655024, name: "R15 Dummy", type: "Model" },
      { id: 6317379768, name: "Zombie AI", type: "Model" }
    ]
  },

  // === PATRONES DE CÓDIGO OPTIMIZADO ===
  patterns: {
    leaderstats: `
local Players = game:GetService("Players")
Players.PlayerAdded:Connect(function(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player
    
    local cash = Instance.new("IntValue")
    cash.Name = "Cash"
    cash.Value = 0
    cash.Parent = leaderstats
end)`,
    
    touchEvent: `
part.Touched:Connect(function(hit)
    local char = hit.Parent
    local hum = char:FindFirstChild("Humanoid")
    if hum then
        hum:TakeDamage(10)
    end
end)`
  },

  // === REGLAS DE ORO (Anti-Errores) ===
  rules: [
    "ALWAYS use task.wait() instead of wait()",
    "NEVER use script.Parent in generated code (scripts are dynamic)",
    "Use MagicAPI.CreateScript for ANY loop or event listener",
    "Store services in local variables at the top",
    "Use Attributes instead of ValueObjects when possible"
  ]
};

export function getContextForQuery(query: string) {
  const q = query.toLowerCase();
  const context = {
    assets: [] as Asset[],
    snippet: ""
  };

  // Detectar intención y adjuntar assets/código
  if (q.includes("sword") || q.includes("weapon")) {
    context.assets.push(...KNOWLEDGE_BASE.assets.weapons);
  }
  if (q.includes("stats") || q.includes("money")) {
    context.snippet = KNOWLEDGE_BASE.patterns.leaderstats;
  }
  
  return context;
}
