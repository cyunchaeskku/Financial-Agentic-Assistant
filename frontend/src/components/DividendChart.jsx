import React, { useState, useEffect, useMemo } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';
import Select from 'react-select';
import { useFinancialContext } from '../store/FinancialContext';

const DividendChart = () => {
    const { selectedChartCorps, setSelectedChartCorps } = useFinancialContext();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Backend API URL (전체 데이터를 가져와서 프론트에서 필터링)
                const response = await axios.get('http://localhost:8000/api/dividends');
                setData(response.data);
                
                // 고유 기업 목록 추출
                const uniqueCompanies = [...new Set(response.data.map(item => item.corp_name))];
                
                // 초기 선택값 설정 (전역 상태가 비어있을 때만 실행)
                if (selectedChartCorps.length === 0) {
                    if (uniqueCompanies.includes('삼성전자')) {
                        setSelectedChartCorps([{ value: '삼성전자', label: '삼성전자' }]);
                    } else if (uniqueCompanies.length > 0) {
                        setSelectedChartCorps([{ value: uniqueCompanies[0], label: uniqueCompanies[0] }]);
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error("Error fetching dividend data:", err);
                setError("Failed to load data from server.");
                setLoading(false);
            }
        };

        fetchData();
    }, []); // 의존성 배열에서 selectedChartCorps 제거 (초기 로딩 시 1회만 체크)

    // 드롭다운 옵션 생성
    const options = useMemo(() => {
        const uniqueCompanies = [...new Set(data.map(item => item.corp_name))];
        return uniqueCompanies.map(name => ({ value: name, label: name }));
    }, [data]);

    if (loading) return <div>Loading chart...</div>;
    if (error) return <div style={{ color: 'red' }}>{error}</div>;

    // 1. 모든 데이터에서 고유한 X축 값(기간) 추출 및 논리적 정렬
    const allPeriods = [...new Set(data.map(d => `${d.year} ${d.reprt_code}`))];
    allPeriods.sort((a, b) => {
        const [yearA, quarterA] = a.split(' ');
        const [yearB, quarterB] = b.split(' ');
        if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
        return quarterA.localeCompare(quarterB);
    });

    // 2. 선택된 기업의 데이터만 필터링하여 Plotly Trace 생성
    const selectedNames = selectedChartCorps ? selectedChartCorps.map(o => o.value) : [];
    
    const traces = selectedNames.map(company => {
        const companyData = data.filter(item => item.corp_name === company);

        return {
            x: companyData.map(d => `${d.year} ${d.reprt_code}`),
            y: companyData.map(d => d.yield),
            type: 'scatter',
            mode: 'lines+markers',
            name: company,
        };
    });

    return (
        <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2>Dividend Trend Analysis (Yield)</h2>
            
            <div style={{ marginBottom: '20px', width: '100%' }}>
                <label>Select Companies to Compare:</label>
                <Select
                    isMulti
                    options={options}
                    value={selectedChartCorps}
                    onChange={setSelectedChartCorps}
                    placeholder="Search and select companies..."
                />
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <Plot
                    data={traces}
                    layout={{
                        autosize: true,
                        title: 'Dividend Yield Trend by Company',
                        xaxis: { 
                            title: 'Period',
                            type: 'category',
                            categoryorder: 'array',
                            categoryarray: allPeriods
                        },
                        yaxis: { title: 'Yield (%)' },
                        showlegend: true,
                        margin: { t: 50, b: 50, l: 50, r: 50 }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ responsive: true }}
                />
            </div>
        </div>
    );
};

export default DividendChart;
