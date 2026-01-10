import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';

const DividendChart = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Backend API URL
                const response = await axios.get('http://localhost:8000/api/dividends');
                setData(response.data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching dividend data:", err);
                setError("Failed to load data from server.");
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div>Loading chart...</div>;
    if (error) return <div style={{ color: 'red' }}>{error}</div>;

    // Process data for Plotly
    // 1. 모든 데이터에서 고유한 X축 값(기간) 추출 및 논리적 정렬
    // 이것이 없으면 데이터 입력 순서에 따라 X축이 뒤죽박죽 섞일 수 있습니다. (예: 삼성 2024 뒤에 LG 2018이 오면 꼬임)
    const allPeriods = [...new Set(data.map(d => `${d.year} ${d.reprt_code}`))];
    
    allPeriods.sort((a, b) => {
        const [yearA, quarterA] = a.split(' ');
        const [yearB, quarterB] = b.split(' ');
        
        if (yearA !== yearB) {
            return parseInt(yearA) - parseInt(yearB);
        }
        
        // 분기 문자열(1Q, 2Q...) 비교
        return quarterA.localeCompare(quarterB);
    });

    // 2. 기업별 데이터 분리
    const companies = [...new Set(data.map(item => item.corp_name))];
    
    const traces = companies.map(company => {
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
        <div style={{ width: '100%', height: '100%' }}>
            <h2>배당 수익률 추이</h2>
            <Plot
                data={traces}
                layout={{
                    width: 1000,
                    height: 600,
                    title: 'Dividend Yield Trend by Company',
                    xaxis: { 
                        title: 'Period',
                        type: 'category', // 명시적으로 범주형 축 선언
                        categoryorder: 'array', // 순서 강제
                        categoryarray: allPeriods // 정렬된 기간 리스트 적용
                    },
                    yaxis: { title: 'Yield (%)' },
                    showlegend: true
                }}
                config={{ responsive: true }}
            />
        </div>
    );
};

export default DividendChart;
