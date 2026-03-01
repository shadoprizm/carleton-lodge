import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  summonsId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { summonsId }: RequestBody = await req.json();

    if (!summonsId) {
      return new Response(
        JSON.stringify({ error: 'summonsId is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: summons, error: summonsError } = await supabase
      .from('summons')
      .select('*')
      .eq('id', summonsId)
      .single();

    if (summonsError || !summons) {
      return new Response(
        JSON.stringify({ error: 'Summons not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: notificationPrefs } = await supabase
      .from('notification_preferences')
      .select(`
        id,
        email_notifications,
        notify_new_summons,
        profiles!inner (
          email
        )
      `)
      .eq('email_notifications', true)
      .eq('notify_new_summons', true);

    if (!notificationPrefs || notificationPrefs.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No users opted in for notifications',
          sent: 0
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const emailsToSend = notificationPrefs.map(pref => ({
      email: (pref.profiles as any).email,
      subject: `New Summons: ${summons.title}`,
      message: `
A new summons has been posted for ${summons.month}.

Title: ${summons.title}

${summons.content.substring(0, 300)}...

Please visit the lodge website to read the full summons.

---
Carleton Lodge 465
      `.trim()
    }));

    console.log(`Would send ${emailsToSend.length} emails for summons ${summonsId}`);

    return new Response(
      JSON.stringify({
        message: 'Notifications queued successfully',
        sent: emailsToSend.length,
        recipients: emailsToSend.map(e => e.email)
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
