import React, { useState, useEffect, useMemo } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';
import Select from 'react-select';

const DividendChart = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOptions, setSelectedOptions] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Backend API URL (전체 데이터를 가져와서 프론트에서 필터링)
                const response = await axios.get('http://localhost:8000/api/dividends');
                setData(response.data);
                
                // 고유 기업 목록 추출
                const uniqueCompanies = [...new Set(response.data.map(item => item.corp_name))];
                
                // 초기 선택값 설정 (예: 삼성전자)
                if (uniqueCompanies.includes('삼성전자')) {
                    setSelectedOptions([{ value: '삼성전자', label: '삼성전자' }]);
                } else if (uniqueCompanies.length > 0) {
                    setSelectedOptions([{ value: uniqueCompanies[0], label: uniqueCompanies[0] }]);
                }

                setLoading(false);
            } catch (err) {
                console.error("Error fetching dividend data:", err);
                setError("Failed to load data from server.");
                setLoading(false);
            }
        };

        fetchData();
    }, []);

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
    const selectedNames = selectedOptions ? selectedOptions.map(o => o.value) : [];
    
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
        <div style={{ padding: '20px' }}>
            <h2>Dividend Trend Analysis (Yield)</h2>
            
            <div style={{ marginBottom: '20px', width: '500px' }}>
                <label>Select Companies to Compare:</label>
                <Select
                    isMulti
                    options={options}
                    value={selectedOptions}
                    onChange={setSelectedOptions}
                    placeholder="Search and select companies..."
                />
            </div>

            <Plot
                data={traces}
                layout={{
                    width: 1000,
                    height: 600,
                    title: 'Dividend Yield Trend by Company',
                    xaxis: { 
                        title: 'Period',
                        type: 'category',
                        categoryorder: 'array',
                        categoryarray: allPeriods
                    },
                    yaxis: { title: 'Yield (%)' },
                    showlegend: true,
                    margin: { t: 50, b: 100, l: 50, r: 50 }
                }}
                config={{ responsive: true }}
            />
        </div>
    );
};

export default DividendChart;
