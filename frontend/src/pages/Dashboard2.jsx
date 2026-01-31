import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Dashboard2 = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCorp, setSelectedCorp] = useState({ corp_name: '삼성전자', corp_code: '00126380' });
  const [showSuggestions, setShowSuggestions] = useState(false);

  // AI Analysis State
  const [insight, setInsight] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch Suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await axios.get(`http://localhost:8000/api/search/corps?query=${encodeURIComponent(searchQuery)}`);
        setSuggestions(response.data);
      } catch (err) {
        console.error("Suggestion error:", err);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300); // Debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = async (corpCode) => {
    setLoading(true);
    setError(null);
    setInsight(''); 
    try {
      const response = await axios.get(`http://localhost:8000/api/financial_statements?corp_code=${corpCode}`);
      if (response.data && response.data.list && response.data.list.length > 0) {
        setData(response.data.list);
      } else {
        setError(response.data.message || "해당 기업의 공시 데이터를 찾을 수 없습니다.");
        setData([]);
      }
    } catch (err) {
      console.error("Error fetching financial statements:", err);
      setError("Failed to load financial data from DART.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedCorp.corp_code);
  }, []);

  const handleSelectCorp = (corp) => {
    setSelectedCorp(corp);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    fetchData(corp.corp_code);
  };

  // Data Processing
  const cfsData = data.filter(item => item.fs_div === 'CFS');

  const parseAmount = (str) => {
    if (!str) return 0;
    return parseInt(str.replace(/,/g, ''), 10);
  };

  const getAccountData = (accountName) => {
    const item = cfsData.find(d => d.account_nm === accountName);
    if (!item) return { x: [], y: [] };

    const x = [item.bfefrmtrm_nm, item.frmtrm_nm, item.thstrm_nm];
    // Convert to 'Baek-man-won' (Million) unit by dividing by 1,000,000
    const y = [
      parseAmount(item.bfefrmtrm_amount) / 1000000,
      parseAmount(item.frmtrm_amount) / 1000000,
      parseAmount(item.thstrm_amount) / 1000000
    ];
    return { x, y, unit: '백만원' };
  };

  const revenue = getAccountData('매출액');
  const operatingIncome = getAccountData('영업이익');
  const netIncome = getAccountData('당기순이익(손실)');
  const assets = getAccountData('자산총계');
  const liabilities = getAccountData('부채총계');
  const equity = getAccountData('자본총계');

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setInsight('');

    // LLM용 데이터 준비 (조/억 단위 변환 지침 포함된 프롬프트 사용 예정)
    const contextData = cfsData.map(item => 
      `| ${item.account_nm} | ${item.bfefrmtrm_amount} (${item.bfefrmtrm_nm}) | ${item.frmtrm_amount} (${item.frmtrm_nm}) | ${item.thstrm_amount} (${item.thstrm_nm}) |`
    ).join('\n');

    const promptContext = `[분석 대상 데이터]\n| 계정명 | 전전기 | 전기 | 당기 |\n| :--- | :---: | :---: | :---: |\n${contextData}\n\n위 데이터를 바탕으로 종합적인 재무 분석 보고서를 작성하세요.`;

    const systemPrompt = `당신은 대기업 기획전략실 및 재무기획팀에서 20년 이상 근무한 베테랑 재무·전략 전문가입니다.
당신의 주요 역할은 기업의 **재무제표**를 기반으로 기업의 재무 상태, 안정성, 리스크 요인을 분석하고 의사결정 인사이트를 제공하는 것입니다.

[작성 원칙]
- Emoji(이모지)는 절대 사용하지 마십시오.
- 수치 가독성: 큰 액수는 '조', '억' 단위를 사용하여 한글로 가독성 있게 표현하십시오. (예: 514조 5,319억 원)
- Fact와 Insight를 명확히 구분하십시오.
- Markdown 보고서 형식(#, ##, Table 활용)을 준수하십시오.

[권장 구조]
# 재무 상태 분석 요약
## 1. 전체 재무 구조 개요
## 2. 자산(Assets) 분석
## 3. 부채(Liabilities) 분석
## 4. 자본(Equity) 및 재무 안정성 평가
## 5. 주요 리스크 및 경영 시사점`;

    try {
        const response = await fetch('http://localhost:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: promptContext }
                ]
            }),
        });

        if (!response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            const chunkValue = decoder.decode(value, { stream: true });
            setInsight(prev => prev + chunkValue);
        }
    } catch (error) {
        console.error("Analysis Error:", error);
        setInsight("분석 중 오류가 발생했습니다.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const commonLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#2c3e50' },
    xaxis: { gridcolor: 'rgba(0,0,0,0.05)', title: 'Account' },
    yaxis: { 
      gridcolor: 'rgba(0,0,0,0.05)', 
      tickformat: ',d', 
      title: '금액 (백만원)' 
    },
    margin: { t: 50, b: 50, l: 100, r: 20 },
    legend: { orientation: 'h', y: -0.2 },
    barmode: 'group'
  };

  const periodLabels = assets.x.length > 0 ? assets.x : ['Before Previous', 'Previous', 'Current'];

  return (
    <div className="fs-analysis-container">
      <div className="fs-header-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
        <div className="title-display-group" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h2 className="fs-page-title" style={{ margin: 0, fontSize: '1.8rem', color: '#2c3e50' }}>Financial Statements Analysis</h2>
            <div style={{ fontSize: '1.8rem', color: '#bdc3c7', fontWeight: '300' }}>|</div>
            <div className="analyzing-corp-name" style={{ fontSize: '2rem', fontWeight: '800', color: '#3498db', letterSpacing: '-0.02em' }}>
                {selectedCorp.corp_name}
            </div>
        </div>
        
        <div className="corp-search-wrapper" style={{ position: 'relative', width: '400px' }}>
            <div className="search-input-box" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <input 
                    type="text" 
                    placeholder="다른 기업 검색..." 
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    style={{
                        padding: '12px 18px',
                        borderRadius: '10px',
                        border: '1px solid #ddd',
                        fontSize: '0.95rem',
                        outline: 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        background: 'rgba(255, 255, 255, 0.9)'
                    }}
                />
            </div>
            {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-list" style={{
                    position: 'absolute', top: '55px', left: 0, right: 0,
                    background: 'white', border: '1px solid #eee', borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 2000,
                    maxHeight: '250px', overflowY: 'auto', listStyle: 'none', padding: '5px 0'
                }}>
                    {suggestions.map((corp, idx) => (
                        <li key={idx} onClick={() => handleSelectCorp(corp)} style={{
                            padding: '10px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9',
                            display: 'flex', justifyContent: 'space-between'
                        }}>
                            <span style={{ fontWeight: '600' }}>{corp.corp_name}</span>
                            <span style={{ color: '#999', fontSize: '0.8rem' }}>{corp.stock_code || '비상장'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>
      
      {loading ? (
        <div style={{ height: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div className="loader" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '20px', color: '#666' }}>DART API로부터 실시간 데이터를 수집 중입니다...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '40px', background: '#fff0f0', border: '1px solid #ffc0c0', borderRadius: '12px', textAlign: 'center', color: '#c00' }}>
            <p>⚠️ {error}</p>
        </div>
      ) : (
        <>
            <div className="fs-charts-grid">
                <div className="glass-card chart-card">
                <h3 className="card-title">Income Statement Trend (단위: 백만원)</h3>
                <Plot
                    data={[
                    { x: ['Revenue', 'Operating Income', 'Net Income'], y: [revenue.y[0], operatingIncome.y[0], netIncome.y[0]], name: periodLabels[0], type: 'bar', marker: { color: '#bdc3c7' } },
                    { x: ['Revenue', 'Operating Income', 'Net Income'], y: [revenue.y[1], operatingIncome.y[1], netIncome.y[1]], name: periodLabels[1], type: 'bar', marker: { color: '#95a5a6' } },
                    { x: ['Revenue', 'Operating Income', 'Net Income'], y: [revenue.y[2], operatingIncome.y[2], netIncome.y[2]], name: periodLabels[2], type: 'bar', marker: { color: '#3498db' } }
                    ]}
                    layout={{ ...commonLayout, title: 'Revenue vs Profit' }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                />
                </div>
                <div className="glass-card chart-card">
                <h3 className="card-title">Balance Sheet Trend (단위: 백만원)</h3>
                <Plot
                    data={[
                    { x: ['Total Assets', 'Total Liabilities', 'Total Equity'], y: [assets.y[0], liabilities.y[0], equity.y[0]], name: periodLabels[0], type: 'bar', marker: { color: '#bdc3c7' } },
                    { x: ['Total Assets', 'Total Liabilities', 'Total Equity'], y: [assets.y[1], liabilities.y[1], equity.y[1]], name: periodLabels[1], type: 'bar', marker: { color: '#95a5a6' } },
                    { x: ['Total Assets', 'Total Liabilities', 'Total Equity'], y: [assets.y[2], liabilities.y[2], equity.y[2]], name: periodLabels[2], type: 'bar', marker: { color: '#f1c40f' } }
                    ]}
                    layout={{ ...commonLayout, title: 'Assets, Liabilities, Equity' }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                />
                </div>
            </div>

            <div className="ai-analysis-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', margin: '30px 0' }}>
                {!isAnalyzing && !insight && (
                    <button onClick={handleAnalyze} style={{ 
                        padding: '12px 30px', 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                        color: 'white', border: 'none', borderRadius: '30px', 
                        cursor: 'pointer', fontWeight: '600', boxShadow: '0 4px 15px rgba(118, 75, 162, 0.3)'
                    }}>
                        Analyze Financial Health
                    </button>
                )}
                {(isAnalyzing || insight) && (
                    <div className="report-paper-card">
                        <div className="report-header">
                            <h3 className="report-title">{isAnalyzing ? 'Analyzing...' : 'Strategic Financial Analysis Report'}</h3>
                            {!isAnalyzing && insight && (
                                <button className="btn-export" onClick={() => {
                                    const blob = new Blob([insight], { type: 'text/markdown' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `Financial_Analysis_${selectedCorp.corp_name}.md`;
                                    a.click();
                                }}>Download Report (.md)</button>
                            )}
                        </div>
                        <div className="report-body">
                            {isAnalyzing ? (
                                <div className="analysis-loading">
                                    <div className="skeleton-line title"></div>
                                    <div className="skeleton-line"></div>
                                    <div className="skeleton-line"></div>
                                    <div className="skeleton-line short"></div>
                                </div>
                            ) : (
                                <div className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="glass-card fs-table-section">
                <h4 className="card-title">Raw Data Summary (Consolidated)</h4>
                <div className="table-wrapper">
                    <table className="fs-table">
                        <thead><tr><th>Account</th><th>Current</th><th>Previous</th><th>Before Previous</th></tr></thead>
                        <tbody>
                            {cfsData.map((item, index) => (
                                <tr key={index}><td className="account-name">{item.account_nm}</td><td className="amount">{item.thstrm_amount}</td><td className="amount">{item.frmtrm_amount}</td><td className="amount">{item.bfefrmtrm_amount}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
      )}

      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        .suggestions-list li:hover { background: #f0f7ff; }
        .report-paper-card { width: 100%; background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); overflow: hidden; position: relative; }
        .report-paper-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: linear-gradient(90deg, #667eea, #764ba2); }
        .report-header { padding: 20px 30px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
        .report-title { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
        .report-body { padding: 30px; min-height: 200px; }
        .btn-export { padding: 8px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: #475569; transition: all 0.2s; }
        .btn-export:hover { background: #f1f5f9; border-color: #94a3b8; }
        .markdown-content { line-height: 1.7; color: #334155; }
        .markdown-content h1, .markdown-content h2 { color: #1e293b; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 20px; }
        .markdown-content table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
        .markdown-content th, .markdown-content td { border: 1px solid #e2e8f0; padding: 10px 15px; text-align: left; }
        .markdown-content th { background: #f8fafc; }
        .analysis-loading { display: flex; flex-direction: column; gap: 12px; animation: pulse 2s infinite; }
        .skeleton-line { height: 12px; background: #e2e8f0; border-radius: 4px; }
        .skeleton-line.title { height: 20px; width: 40%; }
        .skeleton-line.short { width: 70%; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
};

export default Dashboard2;
