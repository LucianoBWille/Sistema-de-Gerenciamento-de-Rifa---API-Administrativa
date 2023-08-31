
var express = require('express');
var createClient = require('@supabase/supabase-js').createClient
var cors = require('cors');
var bodyParser = require('body-parser');
require('dotenv').config()

var app = express();
app.use(cors());
app.use(bodyParser.json());
 
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public'},
    auth: {
        persistSession: false
    }
})

app.listen(3000, () => {
    console.log("Server running on port 3000");
}
);

function logger (req, res, next) {
    const startTime = new Date();

    // Capture the response
    const originalSend = res.send;
    res.send = async function (data) {
        const endTime = new Date();
        const responseTime = endTime - startTime;

        const log = {
            status: res.statusCode,
            method: req.method,
            url: req.url,
            res_time: responseTime,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            req_query: req.query,
            req_body: req.body,
            req_params: req.params,
            res_body: data,
            // objeto da origem da requisição, como o ip, o host, o user-agent, etc
            req_headers: req.headers,
            api_origin: "ADMIN"
        }    

        // console.log(log);

        try {
            const { data, error } = await supabase
                .from('logs')
                .insert([log])
                .select('*')

            if (error) {
                console.log(error)
            } else {
                console.log(data)
            }

        } catch (e) {
            console.log(e)
        } finally {
            originalSend.apply(res, arguments);
        }
    };

    next()
}

app.use(logger)

function getNumberWiththreeDigits(number) {
    if (number < 10) {
        return "00" + number;
    } else if (number < 100) {
        return "0" + number;
    } else {
        return String(number);
    }
}

function addFilters(query, querySupabase){
    const { 
        name,
        includesOrExactly,
        sold,
        contact1,
        contact2,
        contact3,
        paid,
        sold_on,
        has_comprovante,
    } = query;

    if (name) {
        if (includesOrExactly == "includes") {
            querySupabase.ilike('name', '%'+name+'%');
        } else {
            querySupabase.ilike('name', name);
        }
    }
    if (sold === "true") {
        querySupabase.not('sold_on', "is", null);
    }else if (sold === "false") {
        querySupabase.is('sold_on', null);
    }
    if (contact1) {
        querySupabase.eq('contact1', contact1);
    }
    if (contact2) {
        querySupabase.eq('contact2', contact2);
    }
    if (contact3) {
        querySupabase.eq('contact3', contact3);
    }
    if (paid == "true") {
        querySupabase.eq('paid', true);
    }else if (paid == "false") {
        querySupabase.eq('paid', false);
    }
    if (sold_on) {
        // sold berfore date sold_on
        querySupabase.lt('sold_on', sold_on);
    }
    if (has_comprovante == "true") {
        querySupabase.eq('has_comprovante', true);
    }else if (has_comprovante == "false") {
        querySupabase.eq('has_comprovante', false);
    }
}

function addFiltersUpdate(filters, querySupabase){
    const {
        numbers,
    } = filters;
    if(numbers) {
        querySupabase.filter('number', 'in', numbers);
    }
}

app.get("/", async (req, res, next) => {
    console.log(req.query)

    let querySupabase = supabase
        .from('raffles')
        .select('*')
        .order('number', { ascending: true })

    addFilters(req.query, querySupabase);
    
    let { data: raffles, error } = await querySupabase

    // console.log(raffles)
    if (error) {
        console.log(error)
        return res.status(500).json({ 
            message: "Falha ao buscar os números!",
            status: 500,
            error: error
        })
    }else{
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
            message: "Busca realizada com sucesso",
            status: 200,
            raffles: raffles
        })
    }
})

app.put("/markAsPaid", async (req, res, next) => {
    const {
        filters,
    } = req.body;

    if(!filters.numbers) {
        return res.status(400).json({
            message: "Números não informados!",
            status: 400
        })
    } else if(!Array.isArray(filters.numbers)) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(filters.numbers.length == 0) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(!filters.numbers.every((number) => (typeof number == "number"))) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    }

    const { data, error } = await supabase
        .from('raffles')
        .update({ paid: true })
        .in('number', filters.numbers)
        .not('sold_on', "is", null)
        .select('*')
        .order('number', { ascending: true })

    if (error) {
        console.log(error)
        return res.status(500).json({
            message: "Falha ao marcar como pago!",
            status: 500,
            error: error
        })
    }else{
        return res.status(200).json({
            message: "Marcado como pago com sucesso!",
            status: 200,
            raffles: data
        })
    }    
})

// get name from number
app.get("/getName", async (req, res, next) => {
    let {
        number,
    } = req.query;

    if(!number) {
        return res.status(400).json({
            message: "Número não informado!",
            status: 400
        })
    } 

    try{
        number = parseInt(number);
    } catch (e) {
        return res.status(400).json({
            message: "Número inválido!",
            status: 400,
            error: e
        })
    }

    const { data, error } = await supabase
        .from('raffles')
        .select('name')
        .eq('number', number)
        .not('sold_on', "is", null)
        .is('paid', true)

    if (error) {
        console.log(error)
        return res.status(500).json({
            message: "Falha ao buscar o nome!",
            status: 500,
            error: error
        })
    }else{
        if(data.length == 0) {
            res.status(400).json({
                message: "O número sorteado não foi vendido!",
                status: 400
            })
        } else {
            return res.status(200).json({
                message: "Nome encontrado com sucesso!",
                status: 200,
                name: data[0].name
            })
        }
    }
})

app.put("/markAsUnpaid", async (req, res, next) => {
    const {
        filters,
    } = req.body;

    if(!filters.numbers) {
        return res.status(400).json({
            message: "Números não informados!",
            status: 400
        })
    } else if(!Array.isArray(filters.numbers)) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(filters.numbers.length == 0) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(!filters.numbers.every((number) => (typeof number == "number"))) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    }

    const { data, error } = await supabase
        .from('raffles')
        .update({ paid: false })
        .in('number', filters.numbers)
        .is('paid', true)
        .select('*')
        .order('number', { ascending: true })

    if (error) {
        console.log(error)
        return res.status(500).json({
            message: "Falha ao desmarcar como pago!",
            status: 500,
            error: error
        })
    }else{
        return res.status(200).json({
            message: "Desmarcado como pago com sucesso!",
            status: 200,
            raffles: data
        })
    }
})

app.put("/releaseNotPaidNumbers", async (req, res, next) => {
    const {
        filters,
    } = req.body;

    if(!filters.numbers) {
        return res.status(400).json({
            message: "Números não informados!",
            status: 400
        })
    } else if(!Array.isArray(filters.numbers)) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(filters.numbers.length == 0) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(!filters.numbers.every((number) => (typeof number == "number"))) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    }

    const { data, error } = await supabase
        .from('raffles')
        .update({ name: null, sold_on: null, contact1: null, contact2: null, contact3: null, paid: false })
        .is('paid', false)
        .in('number', filters.numbers)
        // sold_on is smaller than today - 2 days
        .lt('sold_on', (new Date(new Date().setDate(new Date().getDate() - 2))).toISOString())
        .select('*')
        .order('number', { ascending: true })

    if (error) {
        console.log(error)
        return res.status(500).json({
            message: "Falha ao liberar os números!",
            status: 500,
            error: error
        })
    }else{
        if(data.length == 0) {
            res.status(400).json({
                message: "Nenhum número foi liberado!",
                status: 400
            })
        } else {
            return res.status(200).json({
                message: "Números liberados com sucesso!",
                status: 200,
                raffles: data
            })
        }
    }
})

app.put("/update", async (req, res, next) => {
    const {
        filters,
        fieldsToUpdate,
    } = req.body;

    if(!filters.numbers) {
        return res.status(400).json({
            message: "Números não informados!",
            status: 400
        })
    } else if(!Array.isArray(filters.numbers)) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(filters.numbers.length == 0) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(!filters.numbers.every((number) => (typeof number == "number"))) {
        return res.status(400).json({
            message: "Números inválidos!",
            status: 400
        })
    } else if(!fieldsToUpdate) {
        return res.status(400).json({
            message: "Campos não informados!",
            status: 400
        })
    }

    const {
        name,
        sold_on,
        contact1,
        contact2,
        contact3,
        paid,
        has_comprovante
    } = fieldsToUpdate;

    const updateFields = {}
    if (name) {
        updateFields.name = name
    }
    if (sold_on) {
        updateFields.sold_on = sold_on
    }
    if (contact1) { 
        updateFields.contact1 = contact1
    }
    if (contact2) {
        updateFields.contact2 = contact2
    }
    if (contact3) {
        updateFields.contact3 = contact3
    }
    if (paid == "true" || paid == true) {
        updateFields.paid = true
    }else if (paid == "false" || paid == false) {
        updateFields.paid = false
    }
    if (has_comprovante == "true" || has_comprovante == true) {
        updateFields.has_comprovante = true
    }else if (has_comprovante == "false" || has_comprovante == false) {
        updateFields.has_comprovante = false
    }

    const { data, error } = await supabase
        .from('raffles')
        .update(updateFields)
        .in('number', filters.numbers)
        .select('*')
        .order('number', { ascending: true })

    if (error) {
        console.log(error)
        return res.status(500).json({
            message: "Falha ao atualizar os números!",
            status: 500,
            error: error
        })
    }else{
        return res.status(200).json({
            message: "Números atualizados com sucesso!",
            status: 200,
            raffles: data
        })
    }
})

app.get("/create", async (req, res, next) => {
    let qtNumbers = req.query.qtNumbers;

    try{
        qtNumbers = parseInt(qtNumbers);
    } catch (e) {
        return res.status(500).json({
            message: "Quantidade de números inválida!",
            status: 500,
            error: e
        })
    }

    const listOfRaffleNumbers = Array.from({length: qtNumbers}, (_, i) => ({
        number: i + 1,
        name: null,
        sold_on: null,
        contact1: null,
        contact2: null,
        contact3: null,
        paid: false,
        has_comprovante: false
    }))

    console.log(listOfRaffleNumbers)

    const { data, error } = await supabase
    .from('raffles')
    .upsert(listOfRaffleNumbers)
    .select()

    if (error) {
        console.log(error)
        return res.status(500).json({ 
            message: "Falha ao criar os números!",
            status: 500,
            error: error
        })
    }else{
        return res.status(200).json({
            message: "Os números foram criados com sucesso!",
            raffles: data,
            status: 200
        })
    }
})