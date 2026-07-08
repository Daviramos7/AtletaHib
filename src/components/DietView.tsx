import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MEALS } from '../data/defaultPlan';
import { addMeal, deleteMeal, listCustomFoods, listMeals, saveCustomFood, searchFoodLocally } from '../services/mealService';
import { todayKey } from '../services/dailyService';

export default function DietView({ userId, profile, onError }) {
  const [date, setDate] = useState(todayKey());
  const [items, setItems] = useState([]);
  const [customFoods, setCustomFoods] = useState([]);
  const [form, setForm] = useState({ meal_type: 'almoco', food_name: '', grams: '', kcal_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '', save_food: true });

  const load = useCallback(async () => {
    try {
      const [mealData, foodData] = await Promise.all([listMeals(userId, date), listCustomFoods(userId)]);
      setItems(mealData);
      setCustomFoods(foodData);
    } catch (err) {
      onError(err.message);
    }
  }, [date, onError, userId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => items.reduce((acc, item) => ({
    kcal: acc.kcal + Number(item.kcal || 0),
    protein: acc.protein + Number(item.protein_g || 0),
    carbs: acc.carbs + Number(item.carbs_g || 0),
    fat: acc.fat + Number(item.fat_g || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [items]);

  const suggestions = searchFoodLocally(form.food_name, customFoods);

  async function handleAdd(event) {
    event.preventDefault();
    try {
      const grams = parsePositiveNumber(form.grams);
      const kcal100 = parseRequiredNonNegativeNumber(form.kcal_per_100g);
      const protein100 = parseOptionalNonNegativeNumber(form.protein_per_100g);
      const carbs100 = parseOptionalNonNegativeNumber(form.carbs_per_100g);
      const fat100 = parseOptionalNonNegativeNumber(form.fat_per_100g);

      if (!form.food_name.trim()) throw new Error('Informe o nome do alimento.');
      if (grams === null) throw new Error('Informe gramas válidas acima de zero.');
      if (kcal100 === null) throw new Error('Informe kcal/100g. Campo vazio não pode virar 0 kcal.');

      const factor = grams / 100;
      await addMeal(userId, {
        log_date: date,
        meal_type: form.meal_type,
        food_name: form.food_name.trim(),
        grams,
        kcal: Math.round(kcal100 * factor),
        protein_g: Number((protein100 * factor).toFixed(1)),
        carbs_g: Number((carbs100 * factor).toFixed(1)),
        fat_g: Number((fat100 * factor).toFixed(1)),
      });

      if (form.save_food) {
        await saveCustomFood(userId, {
          name: form.food_name.trim(),
          kcal_per_100g: Math.round(kcal100),
          protein_per_100g: protein100,
          carbs_per_100g: carbs100,
          fat_per_100g: fat100,
        });
      }

      setForm((old) => ({ ...old, food_name: '', grams: '', kcal_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '' }));
      await load();
    } catch (err) {
      onError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteMeal(userId, id);
      await load();
    } catch (err) {
      onError(err.message);
    }
  }

  function applySuggestion(food) {
    setForm((old) => ({
      ...old,
      food_name: food.name,
      kcal_per_100g: food.kcal_per_100g,
      protein_per_100g: food.protein_per_100g ?? 0,
      carbs_per_100g: food.carbs_per_100g ?? 0,
      fat_per_100g: food.fat_per_100g ?? 0,
    }));
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Dieta</p>
          <h2>Registro alimentar</h2>
        </div>
        <input className="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="metric-grid four">
        <SmallMetric label="Kcal" value={totals.kcal} sub={`meta ${profile?.kcal_goal ?? 2300}`} />
        <SmallMetric label="Proteína" value={`${totals.protein.toFixed(0)}g`} sub="manter músculo" />
        <SmallMetric label="Carbo" value={`${totals.carbs.toFixed(0)}g`} sub="energia treino" />
        <SmallMetric label="Gordura" value={`${totals.fat.toFixed(0)}g`} sub="controle" />
      </div>

      <form className="panel form-grid" onSubmit={handleAdd}>
        <label>Refeição
          <select value={form.meal_type} onChange={(e) => setForm({ ...form, meal_type: e.target.value })}>
            {MEALS.map((meal) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
          </select>
        </label>
        <label>Alimento
          <input value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} placeholder="frango, arroz, macaxeira..." />
        </label>
        <label>Gramas
          <input type="number" min="1" value={form.grams} onChange={(e) => setForm({ ...form, grams: e.target.value })} />
        </label>
        <label>Kcal/100g
          <input type="number" min="0" value={form.kcal_per_100g} onChange={(e) => setForm({ ...form, kcal_per_100g: e.target.value })} />
        </label>
        <label>Proteína/100g
          <input type="number" min="0" step="0.1" value={form.protein_per_100g} onChange={(e) => setForm({ ...form, protein_per_100g: e.target.value })} />
        </label>
        <label>Carbo/100g
          <input type="number" min="0" step="0.1" value={form.carbs_per_100g} onChange={(e) => setForm({ ...form, carbs_per_100g: e.target.value })} />
        </label>
        <label>Gordura/100g
          <input type="number" min="0" step="0.1" value={form.fat_per_100g} onChange={(e) => setForm({ ...form, fat_per_100g: e.target.value })} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={form.save_food} onChange={(e) => setForm({ ...form, save_food: e.target.checked })} /> salvar alimento
        </label>
        <button className="primary-btn"><Plus size={16} /> Adicionar</button>
      </form>

      {suggestions.length > 0 && form.food_name && (
        <div className="suggestions">
          {suggestions.map((food) => <button key={food.id ?? food.name} onClick={() => applySuggestion(food)}>{food.name}<span>{food.kcal_per_100g} kcal/100g</span></button>)}
        </div>
      )}

      <div className="panel">
        <p className="eyebrow">Registros do dia</p>
        {MEALS.map((meal) => {
          const mealItems = items.filter((item) => item.meal_type === meal.id);
          const subtotal = mealItems.reduce((sum, item) => sum + Number(item.kcal), 0);
          return (
            <div key={meal.id} className="meal-group">
              <div className="meal-head"><strong>{meal.name}</strong><span>{subtotal} kcal</span></div>
              {mealItems.length === 0 ? <p className="muted">Nenhum registro.</p> : mealItems.map((item) => (
                <div className="entry-row" key={item.id}>
                  <div><strong>{item.food_name}</strong><span>{Number(item.grams)}g · {item.kcal} kcal</span></div>
                  <button className="icon-btn danger" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SmallMetric({ label, value, sub }) {
  return <div className="small-metric"><span>{label}</span><strong>{value}</strong><p>{sub}</p></div>;
}


function parsePositiveNumber(value: unknown) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseRequiredNonNegativeNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseOptionalNonNegativeNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
