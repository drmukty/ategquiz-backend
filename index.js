const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ==================== TEST ENDPOINT ====================
app.get('/', (req, res) => {
  res.json({ 
    status: '✅ AtegQuiz Backend Running',
    time: new Date().toISOString()
  });
});

// ==================== SUBMIT SCORE ====================
app.post('/submit-score', async (req, res) => {
  try {
    const { telegramId, score, username, firstName } = req.body;
    
    console.log('📥 Received:', { telegramId, score, username });

    // 1. Create or update user
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({ 
        telegram_id: telegramId, 
        username: username || `user_${telegramId}`,
        first_name: firstName || 'Player'
      })
      .select()
      .single();

    if (userError) throw userError;

    // 2. Save daily score
    const today = new Date().toISOString().split('T')[0];
    const { error: scoreError } = await supabase
      .from('daily_scores')
      .upsert({
        user_id: user.id,
        score: score,
        date: today
      });

    if (scoreError) throw scoreError;

    res.json({ 
      success: true, 
      message: '✅ Score saved!',
      user: user.username
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== DAILY LEADERBOARD ====================
app.get('/leaderboard/daily', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('daily_scores')
      .select(`
        score,
        users (username, first_name, telegram_id)
      `)
      .eq('date', today)
      .order('score', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({ 
      success: true, 
      date: today,
      leaderboard: data 
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== ALL-TIME LEADERBOARD ====================
app.get('/leaderboard/alltime', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('all_time_scores')
      .select(`
        total_score,
        games_played,
        users (username, first_name, telegram_id)
      `)
      .order('total_score', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({ 
      success: true, 
      leaderboard: data 
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== USER STATS ====================
app.get('/stats/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (userError) throw userError;

    // Get today's score
    const today = new Date().toISOString().split('T')[0];
    const { data: todayScore } = await supabase
      .from('daily_scores')
      .select('score')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    // Get all-time stats
    const { data: allTime } = await supabase
      .from('all_time_scores')
      .select('*')
      .eq('user_id', user.id)
      .single();

    res.json({
      success: true,
      username: user.username,
      todayScore: todayScore?.score || 0,
      totalScore: allTime?.total_score || 0,
      gamesPlayed: allTime?.games_played || 0
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== DAILY RESET (AUTO) ====================
// This happens automatically via Supabase (date = CURRENT_DATE)
// No code needed - resets every day at midnight!

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📅 Daily leaderboard resets automatically at midnight`);
});
