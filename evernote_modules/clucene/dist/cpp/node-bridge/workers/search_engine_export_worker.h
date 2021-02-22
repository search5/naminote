#ifndef _search_search_engine_export_worker_
#define _search_search_engine_export_worker_

#include <thread>
#include <memory>

#include "napi.h"

#include "CLucene.h"

#include "Misc.h"
#include "repl_tchar.h"

#include "search_engine_context.h"

namespace en_search 
{
    class SearchEngineExportWorker : public Napi::AsyncWorker {
    public:
        SearchEngineExportWorker(
            Napi::Function& callback, 
            std::shared_ptr<SearchEngineContext> search_engine_context);

    // Executed inside the worker-thread.
    // It is not safe to access JS engine data structure
    // here, so everything we need for input and output
    // should go on `this`.
    void Execute() override;
    

    // Executed when the async work is complete
    // this function will be run inside the main event loop
    // so it is safe to use JS engine data again
    void OnOK() override;

    private:
        std::shared_ptr<SearchEngineContext> search_engine_context_;
        
    private:
        std::string error_;
        std::string buffer_;
        int32_t export_time_;
    };
}

#endif