'use client';

import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Package, Calendar } from 'lucide-react';

interface InteractiveChartsProps {
  data: any[];
  onChartClick?: (data: any) => void;
}

export default function InteractiveCharts({ data, onChartClick }: InteractiveChartsProps) {
  const [activeChart, setActiveChart] = useState<'bar' | 'line' | 'pie'>('bar');

  // Prepare chart data - QUANTITY FOCUSED
  const chartData = data.reduce((acc: any[], po: any) => {
    const month = new Date(po.orderDate.toDate()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const existing = acc.find(item => item.month === month);
    const poQty = po.lineItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    
    if (existing) {
      existing.quantity += poQty;
      existing.count += 1;
    } else {
      acc.push({ month, quantity: poQty, count: 1 });
    }
    
    return acc;
  }, []);

  const statusData = data.reduce((acc: any[], po: any) => {
    const existing = acc.find(item => item.status === po.status);
    const poQty = po.lineItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    
    if (existing) {
      existing.value += poQty;
    } else {
      acc.push({ status: po.status, value: poQty });
    }
    return acc;
  }, []);

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleBarClick = (data: any) => {
    if (onChartClick) {
      onChartClick({ type: 'month', data });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Purchase Order Analytics</h3>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveChart('bar')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              activeChart === 'bar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Bar Chart
          </button>
          <button
            onClick={() => setActiveChart('line')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              activeChart === 'line' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Line Chart
          </button>
          <button
            onClick={() => setActiveChart('pie')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              activeChart === 'pie' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pie Chart
          </button>
        </div>
      </div>

      <div className="h-80">
        {activeChart === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} onClick={handleBarClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'quantity') return `${value.toLocaleString()} items`;
                  if (name === 'count') return `${value} POs`;
                  return value;
                }}
              />
              <Legend />
              <Bar dataKey="quantity" fill="#0ea5e9" name="Total Quantity" cursor="pointer" />
              <Bar dataKey="count" fill="#10b981" name="PO Count" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeChart === 'line' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'quantity') return `${value.toLocaleString()} items`;
                  if (name === 'count') return `${value} POs`;
                  return value;
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="quantity" stroke="#0ea5e9" name="Total Quantity" strokeWidth={2} />
              <Line type="monotone" dataKey="count" stroke="#10b981" name="PO Count" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeChart === 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, value, percent }) => `${status}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 text-blue-600 rounded-lg mx-auto mb-2">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.reduce((sum, po) => sum + po.lineItems.reduce((s: number, item: any) => s + item.quantity, 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-600">Total Items</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 bg-green-50 text-green-600 rounded-lg mx-auto mb-2">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.length > 0 ? Math.round(data.reduce((sum, po) => sum + po.lineItems.reduce((s: number, item: any) => s + item.quantity, 0), 0) / data.length) : 0}
          </p>
          <p className="text-xs text-gray-600">Avg Items/PO</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 bg-yellow-50 text-yellow-600 rounded-lg mx-auto mb-2">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.length}</p>
          <p className="text-xs text-gray-600">Total POs</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 bg-purple-50 text-purple-600 rounded-lg mx-auto mb-2">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{chartData.length}</p>
          <p className="text-xs text-gray-600">Active Months</p>
        </div>
      </div>
    </div>
  );
}
