import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard2.css';

const Dashboard2 = () => {
  // State
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCorp, setSelectedCorp] = useState({ corp_name: '삼성전자', corp_code: '00126380' });
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Date Range
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear - 2);
  const [endYear, setEndYear] = useState(currentYear - 1);

  // AI Analysis
  const [insight, setInsight] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const years = Array.from({length: 10}, (_, i) => currentYear - i);

  // Suggestions Fetcher
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 1) { setSuggestions([]); return; }
      try {
        const response = await axios.get(`http://localhost:8000/api/search/corps?query=${encodeURIComponent(searchQuery)}`);
        setSuggestions(response.data);
      } catch (err) { console.error(err); }
    };
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Main Data Fetcher
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setInsight(''); 
    try {
      const response = await axios.get(`http://localhost:8000/api/financial_statements`, {
          params: { corp_code: selectedCorp.corp_code, start_year: startYear, end_year: endYear }
      });
      if (response.data && response.data.list && response.data.list.length > 0) {
        setData(response.data.list);
      } else {
        setError("해당 기간의 공시 데이터가 없습니다.");
        setData([]);
      }
    } catch (err) {
      console.error(err);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedCorp, startYear, endYear]);

  const handleSelectCorp = (corp) => {
    setSelectedCorp(corp);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // --- Data Processing ---
  const periods = [...new Set(data.map(item => item.period_name))];
  const parseAmount = (str) => str ? parseInt(str.replace(/,/g, ''), 10) : 0;

  const getSingleAccountSeries = (accountKeywords) => {
      const keywords = Array.isArray(accountKeywords) ? accountKeywords : [accountKeywords];
      return periods.map(period => {
          const item = data.find(d => 
              d.period_name === period && 
              d.fs_div === 'CFS' &&
              keywords.some(k => d.account_nm.includes(k))
          );
          return {
              name: period,
              value: item ? Math.round(parseAmount(item.thstrm_amount) / 100000000) : 0
          };
      });
  };

  const chartsConfig = [
      { title: '매출액', color: '#3498db', data: getSingleAccountSeries(['매출액', '수익(매출액)']) },
      { title: '영업이익', color: '#2ecc71', data: getSingleAccountSeries(['영업이익', '영업이익(손실)']) },
      { title: '당기순이익', color: '#9b59b6', data: getSingleAccountSeries(['당기순이익', '분기순이익', '반기순이익', '순이익']) },
      { title: '자산총계', color: '#95a5a6', data: getSingleAccountSeries('자산총계') },
      { title: '부채총계', color: '#e74c3c', data: getSingleAccountSeries('부채총계') },
      { title: '자본총계', color: '#f1c40f', data: getSingleAccountSeries('자본총계') }
  ];

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setInsight('');

    // LLM Context Data Construction
    // 각 기간별 6개 주요 지표 요약
    const contextData = periods.map(p => {
        const row = chartsConfig.map(chart => {
            const val = chart.data.find(d => d.name === p)?.value || 0;
            return `${chart.title}: ${val}`;
        }).join(', ');
        return `| ${p} | ${row} |`;
    }).join('\n');

    const promptContext = `[분석 대상: ${selectedCorp.corp_name} (${startYear}~${endYear}) - 단위: 억원]\n${contextData}\n\n위 분기별 추이를 바탕으로 성장성과 수익성을 분석하고, 경영 시사점을 도출하세요.`;
    
    try {
        const response = await fetch('http://localhost:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: `당신은 20년 경력의 CFO입니다. 분기별 재무 데이터를 보고 추세(Trend)와 계절성(Seasonality), 그리고 구조적 변화를 예리하게 분석하여 경영진에게 보고하십시오. 이모지 금지. 수치는 억원 단위 한글 표기(예: 3조 5,000억).` },
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
            setInsight(prev => prev + decoder.decode(value, { stream: true }));
        }
    } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="fs-analysis-container">
        {/* Header */}
        <div className="fs-header-area">
            <div>
                <div className="title-display-group">
                    <h2 className="fs-page-title">FS Analysis</h2>
                    <span className="title-separator">|</span>
                    <h1 className="analyzing-corp-name">{selectedCorp.corp_name}</h1>
                </div>
                
                {/* Date Filter with CSS Classes */}
                <div className="date-filter-container">
                    <span className="filter-label">분석 기간:</span>
                    <select className="year-select" value={startYear} onChange={e=>setStartYear(e.target.value)}>
                        {years.map(y=><option key={y} value={y}>{y}년</option>)}
                    </select>
                    <span className="year-separator">~</span>
                    <select className="year-select" value={endYear} onChange={e=>setEndYear(e.target.value)}>
                        {years.map(y=><option key={y} value={y}>{y}년</option>)}
                    </select>
                    <button className="btn-search" onClick={fetchData}>조회</button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="corp-search-wrapper">
                <div className="search-input-box">
                    <input 
                        type="text" 
                        placeholder="기업 검색..." 
                        value={searchQuery} 
                        onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                        className="corp-search-input"
                    />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                    <ul className="suggestions-list">
                        {suggestions.map((c, i) => (
                            <li key={i} onClick={() => handleSelectCorp(c)} className="suggestion-item">
                                <span className="suggestion-name">{c.corp_name}</span> 
                                <span className="suggestion-code">{c.stock_code}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>

        {loading ? (
            <div className="loading-container">
                <div className="loader"></div>
                <p className="loading-text">DART API로부터 데이터를 수집 중입니다...</p>
            </div>
        ) : error ? (
            <div className="error-container">{error}</div>
        ) : (
            <>
                <div className="charts-grid-wrapper">
                    {chartsConfig.map((chart, idx) => (
                        <div key={idx} className="mini-chart-card">
                            <h4 className="chart-title" style={{ borderLeft: `3px solid ${chart.color}` }}>
                                {chart.title} <span className="chart-unit">(억원)</span>
                            </h4>
                            <ResponsiveContainer width="100%" height="80%">
                                <AreaChart data={chart.data}>
                                    <defs>
                                        <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={chart.color} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={chart.color} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                                                        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#666'}} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                                                                        <YAxis tick={{fontSize: 10, fill: '#666'}} width={65} tickFormatter={val=>val.toLocaleString()} axisLine={false} tickLine={false} />
                                                                        <Tooltip 
                                                                            contentStyle={{fontSize:'12px', borderRadius: '8px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)'}} 
                                                                            formatter={val=>val.toLocaleString()+' 억원'} 
                                                                        />                                    <Area type="monotone" dataKey="value" stroke={chart.color} fill={`url(#grad-${idx})`} strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ))}
                </div>

                {/* AI Analysis */}
                <div className="ai-analysis-section">
                    {!isAnalyzing && !insight && (
                        <button className="btn-analyze" onClick={handleAnalyze}>
                            Analyze Financial Health
                        </button>
                    )}
                    {(isAnalyzing || insight) && (
                        <div className="report-paper-card">
                            <div className="report-header">
                                <h3 className="report-header-title">{isAnalyzing ? 'Analyzing...' : 'Strategic Financial Analysis Report'}</h3>
                                {!isAnalyzing && insight && (
                                    <button className="btn-export" onClick={() => {
                                        const blob = new Blob([insight], { type: 'text/markdown' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Analysis_${selectedCorp.corp_name}.md`;
                                        a.click();
                                    }}>Export .md</button>
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

                {/* Raw Data Table */}
                <div className="fs-table-section">
                    <h4 className="table-title">Raw Data Summary</h4>
                    <div className="table-wrapper">
                        <table className="fs-table">
                            <thead>
                                <tr>
                                    <th>Period</th>
                                    <th>Account</th>
                                    <th className="text-right">Amount (억원)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.filter(item => item.fs_div === 'CFS').map((item, index) => {
                                    const amountEok = Math.round(parseInt(item.thstrm_amount.replace(/,/g, '')) / 100000000);
                                    return (
                                        <tr key={index}>
                                            <td className="period-cell">{item.period_name}</td>
                                            <td className="account-cell">{item.account_nm}</td>
                                            <td className="amount-cell">{amountEok.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        )}
    </div>
  );
};

export default Dashboard2;