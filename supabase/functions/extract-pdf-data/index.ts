import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText } = await req.json();

    if (!pdfText || pdfText.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível extrair texto do PDF. Por favor, preencha os dados manualmente.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Extracting data from PDF text:', pdfText.substring(0, 500));

    const systemPrompt = `Você é um assistente especializado em extrair dados de notas fiscais e recibos brasileiros.
Analise o texto extraído do PDF e identifique os seguintes campos:
- Empresa emissora (nome da empresa que emitiu a nota)
- Hospital/Cliente destinatário
- Data de emissão (formato YYYY-MM-DD)
- Número da nota
- Valor bruto (apenas números, sem símbolos de moeda)
- ISS (Imposto Sobre Serviços) - valor separado
- % ISS (percentual do ISS sobre o valor bruto)
- IRRF (Imposto de Renda Retido na Fonte)
- INSS/CP (Contribuição Previdenciária)
- CSLL (Contribuição Social sobre Lucro Líquido)
- PIS (Programa de Integração Social)
- COFINS (Contribuição para Financiamento da Seguridade Social)
- Total de retenções (soma de IRRF, INSS, CSLL, PIS, COFINS - NÃO incluir ISS)
- Valor líquido (se disponível)

IMPORTANTE: 
- O ISS deve ser extraído separadamente e NÃO deve ser somado no total de retenções.
- Extraia cada imposto individualmente (IRRF, INSS, CSLL, PIS, COFINS).
- Calcule o % ISS como: (ISS / Valor Bruto) * 100
Responda APENAS com os dados extraídos, sem explicações adicionais.
Se um campo não for encontrado, deixe vazio ou 0 para valores numéricos.
Valores monetários devem ser em formato decimal (ex: 10000.00 para R$ 10.000,00)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extraia os dados desta nota fiscal:\n\n${pdfText}` }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_invoice_data',
              description: 'Extrai dados estruturados de uma nota fiscal',
              parameters: {
                type: 'object',
                properties: {
                  companyName: {
                    type: 'string',
                    description: 'Nome da empresa emissora'
                  },
                  hospitalName: {
                    type: 'string',
                    description: 'Nome do hospital ou cliente destinatário'
                  },
                  issueDate: {
                    type: 'string',
                    description: 'Data de emissão no formato YYYY-MM-DD'
                  },
                  invoiceNumber: {
                    type: 'string',
                    description: 'Número da nota fiscal'
                  },
                  grossValue: {
                    type: 'number',
                    description: 'Valor bruto da nota'
                  },
                  issValue: {
                    type: 'number',
                    description: 'Valor do ISS (Imposto Sobre Serviços)'
                  },
                  issPercentage: {
                    type: 'number',
                    description: 'Percentual do ISS sobre o valor bruto'
                  },
                  irrfValue: {
                    type: 'number',
                    description: 'Valor do IRRF (Imposto de Renda Retido na Fonte)'
                  },
                  inssValue: {
                    type: 'number',
                    description: 'Valor do INSS/CP (Contribuição Previdenciária)'
                  },
                  csllValue: {
                    type: 'number',
                    description: 'Valor da CSLL (Contribuição Social sobre Lucro Líquido)'
                  },
                  pisValue: {
                    type: 'number',
                    description: 'Valor do PIS'
                  },
                  cofinsValue: {
                    type: 'number',
                    description: 'Valor do COFINS'
                  },
                  totalDeductions: {
                    type: 'number',
                    description: 'Total de retenções (IRRF + INSS + CSLL + PIS + COFINS) - NÃO incluir ISS'
                  },
                  netValue: {
                    type: 'number',
                    description: 'Valor líquido (se disponível)'
                  }
                },
                required: ['companyName', 'hospitalName', 'issueDate', 'invoiceNumber', 'grossValue']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_invoice_data' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data));

    // Extract the function call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_invoice_data') {
      throw new Error('Resposta inesperada da IA');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting PDF data:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao processar PDF',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
